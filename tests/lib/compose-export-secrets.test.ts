import { describe, it, expect } from "vitest";
import { generateComposeExport } from "@/lib/compose-export-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);

describe("compose-export: secret resolution", () => {
  it("never emits the 'changeme' placeholder, even with no wizard secrets", () => {
    const out = generateComposeExport(makeState({ secrets: {} }), registry);
    expect(out).not.toContain("changeme");
  });

  it("generates a strong secret (not empty / placeholder) when the wizard didn't provide one", () => {
    const out = generateComposeExport(makeState({ secrets: {} }), registry);
    const m = out.match(/(?<!JARVIS_)AUTH_SECRET_KEY: "([^"]*)"/);
    expect(m).toBeTruthy();
    const val = m![1] ?? "";
    expect(val.length).toBeGreaterThanOrEqual(32);
    expect(["", "changeme", "change-me", "__SET_ME__"]).not.toContain(val);
  });

  it("uses the SAME AUTH_SECRET_KEY everywhere it appears (no cross-service mismatch)", () => {
    const out = generateComposeExport(makeState({ secrets: {} }), registry);
    const vals = [...out.matchAll(/(?:JARVIS_)?AUTH_SECRET_KEY: "([^"]+)"/g)].map((m) => m[1]);
    // AUTH_SECRET_KEY (auth + other validators) and JARVIS_AUTH_SECRET_KEY (CC)
    // must all be identical — previously they diverged ("" vs "changeme").
    expect(vals.length).toBeGreaterThan(1);
    expect(new Set(vals).size).toBe(1);
  });

  it("keeps a wizard-provided secret verbatim", () => {
    const provided = "z".repeat(50);
    const out = generateComposeExport(makeState({ secrets: { AUTH_SECRET_KEY: provided } }), registry);
    expect(out).toContain(`AUTH_SECRET_KEY: "${provided}"`);
  });

  it("opts services into production secret enforcement (JARVIS_ENV)", () => {
    const out = generateComposeExport(makeState(), registry);
    expect(out).toContain('JARVIS_ENV: "production"');
  });
});
