import { describe, it, expect } from "vitest";
import {
  parseRegistry,
  getCoreServices,
  getOptionalServices,
  getServicesByCategory,
  getServiceById,
  getInfraById,
  getRequiredInfrastructure,
} from "@/lib/service-registry";
import registryJson from "../../public/service-registry.json";

describe("service-registry", () => {
  describe("parseRegistry", () => {
    it("parses the JSON registry into typed objects", () => {
      const registry = parseRegistry(registryJson);
      expect(registry.version).toBe("1.0.0");
      expect(registry.services.length).toBeGreaterThan(0);
      expect(registry.infrastructure.length).toBeGreaterThan(0);
    });

    it("preserves all service fields", () => {
      const registry = parseRegistry(registryJson);
      const auth = registry.services.find((s) => s.id === "jarvis-auth");
      expect(auth).toBeDefined();
      expect(auth!.name).toBe("Auth Service");
      expect(auth!.category).toBe("core");
      expect(auth!.port).toBe(8007);
      expect(auth!.image).toContain("jarvis-auth");
      expect(auth!.healthCheck).toBe("/health");
      expect(auth!.dependsOn).toContain("postgres");
      expect(auth!.envVars.length).toBeGreaterThan(0);
    });

    it("preserves all infrastructure fields", () => {
      const registry = parseRegistry(registryJson);
      const pg = registry.infrastructure.find((i) => i.id === "postgres");
      expect(pg).toBeDefined();
      expect(pg!.name).toBe("PostgreSQL");
      expect(pg!.image).toContain("postgres");
      expect(pg!.port).toBe(5432);
      expect(pg!.volumes.length).toBeGreaterThan(0);
    });
  });

  describe("getCoreServices", () => {
    it("returns only services with category 'core'", () => {
      const registry = parseRegistry(registryJson);
      const core = getCoreServices(registry);
      expect(core.length).toBeGreaterThan(0);
      expect(core.every((s) => s.category === "core")).toBe(true);
    });

    it("includes auth, command-center, whisper, tts, logs, config, mcp, admin", () => {
      const registry = parseRegistry(registryJson);
      const core = getCoreServices(registry);
      const ids = core.map((s) => s.id);
      expect(ids).toContain("jarvis-auth");
      expect(ids).toContain("jarvis-command-center");
      expect(ids).toContain("jarvis-whisper");
      expect(ids).toContain("jarvis-tts");
      expect(ids).toContain("jarvis-logs");
      expect(ids).toContain("jarvis-config-service");
      expect(ids).toContain("jarvis-mcp");
      expect(ids).toContain("jarvis-admin");
    });
  });

  describe("getOptionalServices", () => {
    it("returns only services with category 'optional'", () => {
      const registry = parseRegistry(registryJson);
      const optional = getOptionalServices(registry);
      expect(optional.length).toBeGreaterThan(0);
      expect(optional.every((s) => s.category === "optional")).toBe(true);
    });

    it("includes ocr and recipes", () => {
      const registry = parseRegistry(registryJson);
      const optional = getOptionalServices(registry);
      const ids = optional.map((s) => s.id);
      expect(ids).toContain("jarvis-ocr-service");
      expect(ids).toContain("jarvis-recipes");
    });
  });

  describe("getServicesByCategory", () => {
    it("groups services by category", () => {
      const registry = parseRegistry(registryJson);
      const grouped = getServicesByCategory(registry);
      expect(grouped.core.length).toBeGreaterThan(0);
      expect(grouped.optional.length).toBeGreaterThan(0);
      expect(grouped.core.length + grouped.optional.length).toBe(
        registry.services.length,
      );
    });
  });

  describe("getServiceById", () => {
    it("finds a service by its id", () => {
      const registry = parseRegistry(registryJson);
      const service = getServiceById(registry, "jarvis-auth");
      expect(service).toBeDefined();
      expect(service!.id).toBe("jarvis-auth");
    });

    it("returns undefined for unknown id", () => {
      const registry = parseRegistry(registryJson);
      const service = getServiceById(registry, "nonexistent");
      expect(service).toBeUndefined();
    });
  });

  describe("getInfraById", () => {
    it("finds infrastructure by its id", () => {
      const registry = parseRegistry(registryJson);
      const infra = getInfraById(registry, "postgres");
      expect(infra).toBeDefined();
      expect(infra!.id).toBe("postgres");
    });

    it("returns undefined for unknown id", () => {
      const registry = parseRegistry(registryJson);
      const infra = getInfraById(registry, "nonexistent");
      expect(infra).toBeUndefined();
    });
  });

  describe("getRequiredInfrastructure", () => {
    it("returns infrastructure needed by enabled services", () => {
      const registry = parseRegistry(registryJson);
      const enabledServiceIds = ["jarvis-auth", "jarvis-logs"];
      const infra = getRequiredInfrastructure(registry, enabledServiceIds);
      const infraIds = infra.map((i) => i.id);
      expect(infraIds).toContain("postgres");
      expect(infraIds).toContain("loki");
    });

    it("deduplicates infrastructure", () => {
      const registry = parseRegistry(registryJson);
      // Both auth and command-center depend on postgres
      const enabledServiceIds = ["jarvis-auth", "jarvis-command-center"];
      const infra = getRequiredInfrastructure(registry, enabledServiceIds);
      const pgCount = infra.filter((i) => i.id === "postgres").length;
      expect(pgCount).toBe(1);
    });

    it("returns empty array when no infra is needed", () => {
      const registry = parseRegistry(registryJson);
      // whisper has no infra dependencies
      const infra = getRequiredInfrastructure(registry, ["jarvis-whisper"]);
      expect(infra).toEqual([]);
    });
  });
});
