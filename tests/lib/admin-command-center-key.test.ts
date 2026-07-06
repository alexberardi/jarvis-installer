import { describe, it, expect } from "vitest";
import { generateCompose } from "@/lib/compose-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);

// Slice the YAML block for one service: from `  <id>:` down to the next line at
// the same-or-shallower indent that ends in `:` (the next service or top-level
// section). Indent-based so it survives generator reordering.
function serviceBlock(compose: string, id: string): string {
  const lines = compose.split("\n");
  const start = lines.findIndex((l) => l.trim() === `${id}:`);
  if (start === -1) return "";
  const startLine = lines[start] ?? "";
  const indent = startLine.length - startLine.trimStart().length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (l.trim() === "") continue;
    const ind = l.length - l.trimStart().length;
    if (ind <= indent && l.trim().endsWith(":")) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

describe("jarvis-admin → command-center admin key wiring", () => {
  it("injects COMMAND_CENTER_ADMIN_KEY (from the shared ADMIN_API_KEY secret) into jarvis-admin", () => {
    const output = generateCompose(
      makeState({ enabledModules: ["jarvis-admin"] }),
      registry,
    );
    const block = serviceBlock(output, "jarvis-admin");
    expect(block).not.toBe("");
    expect(block).toContain("COMMAND_CENTER_ADMIN_KEY: ${ADMIN_API_KEY}");
  });

  it("scopes the key to jarvis-admin — absent when it is not enabled", () => {
    const output = generateCompose(makeState({ enabledModules: [] }), registry);
    expect(output).not.toContain("COMMAND_CENTER_ADMIN_KEY");
  });
});
