import { describe, it, expect } from "vitest";
import { generateReadme } from "@/lib/readme-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);

describe("readme-generator", () => {
  it("generates markdown content", () => {
    const readme = generateReadme(makeState(), registry);
    expect(readme).toContain("# Jarvis");
    expect(readme).toContain("##");
  });

  it("includes quick start instructions", () => {
    const readme = generateReadme(makeState(), registry);
    expect(readme).toContain("docker compose up -d");
  });

  it("includes core services section", () => {
    const readme = generateReadme(makeState(), registry);
    expect(readme).toContain("### Core");
    expect(readme).toContain("Auth Service");
    expect(readme).toContain("Command Center");
  });

  it("includes optional services when enabled", () => {
    const readme = generateReadme(
      makeState({ enabledModules: ["jarvis-recipes-server"] }),
      registry,
    );
    expect(readme).toContain("### Optional");
    expect(readme).toContain("Recipes Service");
  });

  it("includes health check commands", () => {
    const readme = generateReadme(makeState(), registry);
    expect(readme).toContain("curl http://localhost:");
    expect(readme).toContain("/health");
  });

  it("includes database section", () => {
    const readme = generateReadme(makeState(), registry);
    expect(readme).toContain("## Database");
    expect(readme).toContain("jarvis_auth");
    expect(readme).toContain("jarvis_config");
  });

  it("shows port overrides in service list", () => {
    const readme = generateReadme(
      makeState({ portOverrides: { "jarvis-auth": 9007 } }),
      registry,
    );
    expect(readme).toContain("port 9007");
  });
});
