import { describe, it, expect } from "vitest";
import { generateCompose } from "@/lib/compose-generator";
import { generateEnv } from "@/lib/env-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

/**
 * COMPOSE ↔ ENV CONTRACT (the blank-secret outage class, 2026-07-04/06):
 * a generated compose must never reference a bare `${VAR}` that the
 * generated .env leaves undefined or empty — services would come up with
 * blank secrets. The two files are a SET; this enforces it at birth.
 */

const registry = parseRegistry(registryJson);

// Vars resolved by the runtime environment, not the .env file.
const RUNTIME_PROVIDED = new Set(["HOME"]);

function envKeys(env: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of env.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    map.set(t.slice(0, i), t.slice(i + 1));
  }
  return map;
}

describe("compose ↔ env contract (fresh install)", () => {
  // Maximal install: every module the registry offers, GPU everything.
  const allIds = [
    ...registry.services.map((s) => s.id),
  ];
  const state = makeState({
    enabledModules: allIds,
    whisperBackend: "cuda",
    ttsBackend: "cuda",
    gpuEnabled: true,
    gpuType: "nvidia",
  });
  const compose = generateCompose(state, registry);
  const env = generateEnv(state, registry);
  const defined = envKeys(env);

  it("every bare ${VAR} the compose references is defined NON-EMPTY in the generated .env", () => {
    const bare = new Set<string>();
    for (const m of compose.matchAll(/\$\{([A-Z0-9_]+)\}/g)) bare.add(m[1]!);

    const missing: string[] = [];
    for (const v of bare) {
      if (RUNTIME_PROVIDED.has(v)) continue;
      if (!defined.get(v)) missing.push(v);
    }
    expect(
      missing,
      `compose references these vars but .env leaves them undefined/empty: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("no secret-shaped key gets a literally-empty ${VAR:-} fallback", () => {
    const emptyDefaultSecrets = [
      ...compose.matchAll(/\$\{([A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|KEY)[A-Z0-9_]*):-\}/g),
    ]
      .map((m) => m[1]!)
      // App-to-app creds are intentionally empty until service registration.
      .filter((v) => !v.startsWith("JARVIS_APP_ID_") && !v.startsWith("JARVIS_APP_KEY_"));
    expect(emptyDefaultSecrets).toEqual([]);
  });
});
