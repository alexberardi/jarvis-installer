import { describe, it, expect } from "vitest";
import { generateInitDbScript } from "@/lib/init-db-generator";
import type { ServiceDefinition } from "@/types/service-registry";

function makeService(overrides: Partial<ServiceDefinition> = {}): ServiceDefinition {
  return {
    id: "test-service",
    name: "Test",
    description: "",
    category: "core",
    port: 8000,
    image: "",
    healthCheck: "/health",
    dependsOn: [],
    envVars: [],
    ...overrides,
  };
}

describe("init-db-generator", () => {
  it("generates a valid bash script", () => {
    const script = generateInitDbScript([], "jarvis_config");
    expect(script).toContain("#!/bin/bash");
    expect(script).toContain("set -e");
  });

  it("skips the primary database (created by POSTGRES_DB)", () => {
    const services = [
      makeService({ id: "config", database: "jarvis_config" }),
      makeService({ id: "auth", database: "jarvis_auth" }),
    ];
    const script = generateInitDbScript(services, "jarvis_config");
    expect(script).not.toContain("CREATE DATABASE jarvis_config");
    expect(script).toContain("CREATE DATABASE jarvis_auth");
  });

  it("creates SQL for additional databases", () => {
    const services = [
      makeService({ id: "auth", database: "jarvis_auth" }),
      makeService({ id: "cc", database: "jarvis_command_center" }),
      makeService({ id: "recipes", database: "jarvis_recipes" }),
    ];
    const script = generateInitDbScript(services, "jarvis_config");
    expect(script).toContain("jarvis_auth");
    expect(script).toContain("jarvis_command_center");
    expect(script).toContain("jarvis_recipes");
  });

  it("skips services without a database", () => {
    const services = [
      makeService({ id: "whisper" }),
      makeService({ id: "auth", database: "jarvis_auth" }),
    ];
    const script = generateInitDbScript(services, "jarvis_config");
    expect(script).toContain("jarvis_auth");
  });

  it("uses idempotent CREATE DATABASE with WHERE NOT EXISTS", () => {
    const services = [makeService({ id: "auth", database: "jarvis_auth" })];
    const script = generateInitDbScript(services, "jarvis_config");
    expect(script).toContain("WHERE NOT EXISTS");
  });
});
