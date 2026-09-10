import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { parse as parseYaml } from "yaml";
import { generateComposeExport } from "@/lib/compose-export-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);

// Several services are generated with an inline shell script: the config and
// auth seeds run `python -c '<program>'`, minio-init runs an mc loop, and every
// migrate service gets an alembic-then-exec wrapper. Registry text is
// interpolated into those, and the seed only escaped DOUBLE quotes -- for the
// inner Python string -- while a single quote closes the outer SHELL quote and
// turns the remainder of the program into shell.
//
// A description reading "see the repo's DEPLOYMENT.md" produced:
//
//   jarvis-config-service | sh: 19: Syntax error: ")" unexpected
//
// after migrations had already succeeded, so the container crash-looped and
// every other service failed discovery against it -- from a docstring.
//
// Rather than assert on escaping, hand the scripts to `sh -n` and let the shell
// judge. That covers every generated script, not just the one that broke.

type Svc = { command?: string[] | string; entrypoint?: string[] | string };

function shellScripts(compose: { services: Record<string, Svc> }): Array<[string, string]> {
  const scripts: Array<[string, string]> = [];
  for (const [id, svc] of Object.entries(compose.services)) {
    for (const [field, value] of [
      ["command", svc.command],
      ["entrypoint", svc.entrypoint],
    ] as const) {
      if (!Array.isArray(value)) continue;
      // ["sh", "-c", "<script>"] / ["/bin/sh", "-c", "<script>", "$0"]
      const dashC = value.indexOf("-c");
      const shell = String(value[0] ?? "");
      if (dashC === -1 || !/\b(sh|bash)$/.test(shell)) continue;
      const script = value[dashC + 1];
      if (typeof script === "string" && script.trim()) {
        scripts.push([`${id}.${field}`, script]);
      }
    }
  }
  return scripts;
}

function syntaxError(script: string): string | null {
  try {
    execFileSync("sh", ["-n", "-c", script], { stdio: "pipe" });
    return null;
  } catch (err) {
    const e = err as { stderr?: Buffer; message?: string };
    return e.stderr?.toString().trim() || e.message || "unknown";
  }
}

function composeWith(reg: typeof registry) {
  const state = makeState({ enabledModules: reg.services.map((s) => s.id) });
  return parseYaml(generateComposeExport(state, reg)) as { services: Record<string, Svc> };
}

describe("generated shell scripts are valid shell", () => {
  it("finds scripts to check", () => {
    expect(shellScripts(composeWith(registry)).length).toBeGreaterThan(0);
  }, 30_000);

  it("every inline sh -c script passes sh -n", () => {
    const failures = shellScripts(composeWith(registry))
      .map(([where, script]) => [where, syntaxError(script)] as const)
      .filter(([, err]) => err !== null)
      .map(([where, err]) => `${where}: ${err}`);

    expect(failures).toEqual([]);
  }, 30_000);

  it("survives registry text full of quotes and shell metacharacters", () => {
    // Not asserted against the current descriptions on purpose -- the point is
    // that ANY description is safe, including one written years from now.
    const hostile = structuredClone(registry);
    const nasty =
      `it's a "quoted" thing; $(echo pwned) \`whoami\` && rm -rf / | tee 'x' # trailing`;
    for (const svc of hostile.services) {
      svc.description = nasty;
    }

    const failures = shellScripts(composeWith(hostile))
      .map(([where, script]) => [where, syntaxError(script)] as const)
      .filter(([, err]) => err !== null)
      .map(([where, err]) => `${where}: ${err}`);

    expect(failures).toEqual([]);
  }, 30_000);

  it("does not let registry text escape into shell execution", () => {
    // A description must be DATA. If command substitution survives escaping,
    // the seed would run it as root at container start.
    const hostile = structuredClone(registry);
    for (const svc of hostile.services) {
      svc.description = "$(touch /tmp/pwned) `touch /tmp/pwned2`";
    }
    const scripts = shellScripts(composeWith(hostile));
    const seed = scripts.find(([where]) => where.startsWith("jarvis-config-service"));
    expect(seed, "config seed script not found").toBeTruthy();

    // The substitution must appear literally, inside the quoted payload,
    // never as an unquoted expansion the shell would evaluate.
    expect(seed![1]).toContain("$(touch /tmp/pwned)");
    expect(syntaxError(seed![1])).toBeNull();
  }, 30_000);
});
