import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import { generateComposeExport } from "@/lib/compose-export-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);
const migrateServices = registry.services.filter((s) => s.migrate);

// A `migrate: true` service gets an entrypoint that migrates then execs "$@".
// Overriding entrypoint clears the image CMD, so the generator must supply the
// serve command -- and it must be the RIGHT one. Two ways this has broken in
// production:
//
//   no command at all  -> exec "" and the container exits after migrating
//   wrong module path  -> ModuleNotFoundError: No module named 'app'
//
// The second reached prod because the command was inferred from an if-chain of
// service ids: anything not explicitly named got `app.main:app`, and
// jarvis-recipes-server packages its app at `jarvis_recipes.app.main`.

describe("migrate services declare their own serve command", () => {
  it("has migrate services to check", () => {
    expect(migrateServices.length).toBeGreaterThan(0);
  });

  it.each(migrateServices.map((s) => s.id))(
    "%s declares a non-empty serveCommand",
    (id) => {
      const service = registry.services.find((s) => s.id === id)!;
      expect(service.serveCommand?.length).toBeGreaterThan(0);
    },
  );

  it("refuses to generate a migrate service with no serveCommand", () => {
    const broken = structuredClone(registry);
    // jarvis-auth and jarvis-config-service supply seed scripts as their command
    // instead of going through serveCommand, so pick a service that does not.
    const victim = broken.services.find(
      (s) => s.migrate && s.id !== "jarvis-auth" && s.id !== "jarvis-config-service",
    )!;
    delete victim.serveCommand;

    const state = makeState({ enabledModules: [victim.id] });
    expect(() => generateComposeExport(state, broken)).toThrow(/serveCommand/);
  });

  it("every emitted migrate service has a command", () => {
    const state = makeState({ enabledModules: migrateServices.map((s) => s.id) });
    const compose = parseYaml(generateComposeExport(state, registry));

    const emitted = migrateServices.filter((s) => compose.services[s.id]);
    expect(emitted.length).toBeGreaterThan(0);

    for (const service of emitted) {
      const block = compose.services[service.id];
      expect(block.entrypoint, `${service.id} should migrate on start`).toBeDefined();
      expect(block.command, `${service.id} would exec "" and exit`).toBeTruthy();
      expect(block.command.length).toBeGreaterThan(0);
    }
  });

  it("serves recipes-server from jarvis_recipes.app.main, not app.main", () => {
    const state = makeState({ enabledModules: ["jarvis-recipes-server"] });
    const compose = parseYaml(generateComposeExport(state, registry));
    const command: string[] = compose.services["jarvis-recipes-server"].command;

    expect(command).toContain("jarvis_recipes.app.main:app");
    expect(command).not.toContain("app.main:app");
  });

  it("keeps llm-proxy on its supervised launcher", () => {
    // Not uvicorn: the unsupervised variant meant a native model-service crash
    // was never respawned and the API 503'd forever (2026-07-02 outage).
    const state = makeState({ enabledModules: ["jarvis-llm-proxy-api"] });
    const compose = parseYaml(generateComposeExport(state, registry));
    const command: string[] = compose.services["jarvis-llm-proxy-api"].command;

    expect(command).toEqual(["bash", "scripts/serve.sh"]);
  });

  it("substitutes the container port into the serve command", () => {
    const state = makeState({ enabledModules: ["jarvis-recipes-server"] });
    const compose = parseYaml(generateComposeExport(state, registry));
    const command: string[] = compose.services["jarvis-recipes-server"].command;

    expect(command.join(" ")).not.toContain("{{CONTAINER_PORT}}");
  });
});
