import { describe, it, expect } from "vitest";
import { generateCompose } from "@/lib/compose-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);

describe("compose-generator", () => {
  it("generates output starting with services:", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("services:");
    expect(output).not.toContain("version:");
  });

  it("always includes core services", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("jarvis-config-service:");
    expect(output).toContain("jarvis-auth:");
    expect(output).toContain("jarvis-command-center:");
    expect(output).toContain("jarvis-logs:");
  });

  it("includes optional services when enabled", () => {
    const output = generateCompose(
      makeState({ enabledModules: ["jarvis-recipes-server", "jarvis-ocr-service"] }),
      registry,
    );
    expect(output).toContain("jarvis-recipes-server:");
    expect(output).toContain("jarvis-ocr-service:");
  });

  it("excludes optional services when not enabled", () => {
    const output = generateCompose(makeState({ enabledModules: [] }), registry);
    expect(output).not.toContain("jarvis-recipes-server:");
    expect(output).not.toContain("jarvis-ocr-service:");
  });

  it("includes postgres infrastructure", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("postgres:");
    expect(output).toContain("postgres:16-alpine");
  });

  it("uses ${VAR} substitution for ports", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("${AUTH_PORT:-8007}");
    expect(output).toContain("${COMMAND_CENTER_PORT:-8002}");
  });

  it("applies port overrides in default values", () => {
    const output = generateCompose(
      makeState({ portOverrides: { "jarvis-auth": 9007 } }),
      registry,
    );
    expect(output).toContain("${AUTH_PORT:-9007}");
  });

  it("includes health checks", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("healthcheck:");
    expect(output).toContain("/health");
  });

  it("includes depends_on with conditions", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("depends_on:");
    expect(output).toContain("condition: service_healthy");
    expect(output).toContain("condition: service_started");
  });

  it("includes loki when logs service is present", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("loki:");
  });

  it("includes redis with requirepass command", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("redis:");
    expect(output).toContain("requirepass");
  });

  it("includes postgres init-db.sh volume mount", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("init-db.sh:/docker-entrypoint-initdb.d/init-db.sh");
  });

  it("includes network definition", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("networks:");
    expect(output).toContain("jarvis:");
  });

  it("includes volumes definition", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("volumes:");
    expect(output).toContain("jarvis-postgres-data:");
  });

  it("uses correct GHCR images", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("ghcr.io/alexberardi/jarvis-auth:latest");
    expect(output).toContain("ghcr.io/alexberardi/jarvis-command-center:latest");
  });

  it("includes DATABASE_URL for services with databases", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("DATABASE_URL:");
    expect(output).toContain("MIGRATIONS_DATABASE_URL:");
  });

  it("adds whisper model volume mount for non-default model", () => {
    const output = generateCompose(
      makeState({
        enabledModules: ["jarvis-whisper-api"],
        whisperModel: "large-v3",
      }),
      registry,
    );
    expect(output).toContain("./models:/models:ro");
    expect(output).toContain("WHISPER_MODEL: /models/ggml-large-v3.bin");
  });

  it("does not add whisper volume for default model", () => {
    const output = generateCompose(
      makeState({ enabledModules: ["jarvis-whisper-api"], whisperModel: "base.en" }),
      registry,
    );
    expect(output).not.toContain("./models:/models:ro");
    expect(output).not.toContain("WHISPER_MODEL:");
  });
});
