import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import { generateComposeExport } from "@/lib/compose-export-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);

// Every service gets JARVIS_ENV=production, which turns each service's own
// secret guard from a warning into a hard refusal to boot. jarvis-recipes-server
// verifies user JWTs locally -- accepting HS256 and RS256 during the migration --
// so it needs the HS256 secret, and its config enforces that:
//
//   RuntimeError: Refusing to start in production — insecure config:
//   AUTH_SECRET_KEY is empty, a known placeholder, or shorter than 16 chars.
//
// This registry had simply never declared AUTH_SECRET_KEY for it (the admin copy
// does), and no per-service block in the generator covers it, so the container
// crash-looped and the whole install-e2e stack failed to come up.
//
// Keyed by the variable each service actually READS -- they disagree, which is
// half of why this was easy to miss.
const LOCAL_JWT_VERIFIERS: Array<[string, string]> = [
  ["jarvis-recipes-server", "AUTH_SECRET_KEY"],
  ["jarvis-command-center", "JARVIS_AUTH_SECRET_KEY"],
  ["jarvis-settings-server", "JARVIS_AUTH_SECRET_KEY"],
];

type Svc = { environment?: Record<string, string> };

function composeFor(modules: string[]): Record<string, Svc> {
  const state = makeState({ enabledModules: modules });
  return (parseYaml(generateComposeExport(state, registry)) as { services: Record<string, Svc> })
    .services;
}

describe("services that verify user JWTs locally get a key", () => {
  it.each(LOCAL_JWT_VERIFIERS)("%s receives a usable %s", (id, varName) => {
    const services = composeFor([id]);
    const value = services[id]?.environment?.[varName];

    expect(value, `${id} has no ${varName}; it refuses to boot in production`).toBeTruthy();
    // The guard rejects anything under 16 chars as a placeholder.
    expect(String(value).length).toBeGreaterThanOrEqual(16);
    expect(String(value)).not.toContain("${");
  }, 30_000);

  it("gives the recipes worker the same key as its parent", () => {
    // The worker runs the same image and imports the same config module, so it
    // hits the same guard on startup.
    const services = composeFor(["jarvis-recipes-server"]);
    const parent = services["jarvis-recipes-server"]?.environment?.AUTH_SECRET_KEY;
    const worker = services["jarvis-recipes-worker"]?.environment?.AUTH_SECRET_KEY;

    expect(worker).toBeTruthy();
    expect(worker).toBe(parent);
  }, 30_000);
});

describe("declared secrets resolve to real values", () => {
  it("never emits an empty value for a registry secretRef", () => {
    const services = composeFor(registry.services.map((s) => s.id));

    const empties: string[] = [];
    for (const service of registry.services) {
      const env = services[service.id]?.environment;
      if (!env) continue;
      for (const declared of service.envVars ?? []) {
        if (!declared.secretRef) continue;
        const value = env[declared.name];
        if (value === undefined) continue; // absence is a different test
        if (!String(value).trim() || String(value).includes("${")) {
          empties.push(`${service.id}.${declared.name}`);
        }
      }
    }
    expect(empties).toEqual([]);
  }, 30_000);
});
