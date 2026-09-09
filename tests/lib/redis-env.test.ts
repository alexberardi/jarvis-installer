import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import { generateComposeExport } from "@/lib/compose-export-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

// A service that depends on redis has to be told how to reach it. Neither
// jarvis-recipes-server nor jarvis-ocr-service declared any REDIS_* env, and
// both default to localhost in code, so their queue workers dialled their own
// container and never consumed a job:
//
//   redis.exceptions.ConnectionError: Error 111 connecting to localhost:6379
//
// The OCR worker crash-looped, which was at least visible. The recipes worker
// caught the error and stayed up, so compose reported it healthy while it
// processed nothing -- image import was silently dead on arrival.

const registry = parseRegistry(registryJson);
const redisDependents = registry.services.filter((s) =>
  (s.dependsOn ?? []).includes("redis"),
);

describe("services that depend on redis can reach it", () => {
  it("has redis-dependent services to check", () => {
    expect(redisDependents.length).toBeGreaterThan(0);
  });

  // Asserted against the GENERATED env rather than the declaration: most
  // services declare their wiring in the registry, but llm-proxy's REDIS_URL is
  // still supplied by a hardcoded generator branch. What matters either way is
  // that the container ends up able to reach the broker.
  it.each(redisDependents.map((s) => s.id))("%s is wired to redis", (id) => {
    const state = makeState({ enabledModules: [id] });
    const compose = parseYaml(generateComposeExport(state, registry));
    const env = compose.services[id]?.environment ?? {};

    const wiring = env.REDIS_HOST ?? env.REDIS_URL;
    expect(wiring, `${id} depends on redis but is told nothing about it`).toBeTruthy();
    expect(String(wiring)).not.toContain("localhost");
  });

  it("emits a routable redis host, never the in-code localhost default", () => {
    const state = makeState({ enabledModules: redisDependents.map((s) => s.id) });
    const compose = parseYaml(generateComposeExport(state, registry));

    for (const service of redisDependents) {
      const block = compose.services[service.id];
      if (!block) continue;
      const env = block.environment ?? {};
      const host = env.REDIS_HOST ?? env.REDIS_URL;
      expect(host, `${service.id} has no redis wiring`).toBeTruthy();
      expect(String(host)).not.toContain("localhost");
      expect(String(host)).not.toContain("127.0.0.1");
    }
  });

  it("gives the sibling workers the same wiring", () => {
    // The workers are what actually consume the queues; they inherit the
    // parent's environment, so a gap here is what took them down.
    const state = makeState({
      enabledModules: ["jarvis-recipes-server", "jarvis-ocr-service"],
    });
    const compose = parseYaml(generateComposeExport(state, registry));

    for (const id of ["jarvis-recipes-worker", "jarvis-ocr-worker"]) {
      const block = compose.services[id];
      if (!block) continue;
      const env = block.environment ?? {};
      expect(env.REDIS_HOST ?? env.REDIS_URL, `${id} cannot reach redis`).toBeTruthy();
      expect(String(env.REDIS_HOST ?? env.REDIS_URL)).not.toContain("localhost");
    }
  });
});
