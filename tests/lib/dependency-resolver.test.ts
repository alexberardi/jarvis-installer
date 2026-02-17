import { describe, it, expect } from "vitest";
import {
  resolveModuleToggle,
  getRequiredDependencies,
  validateModuleSelection,
} from "@/lib/dependency-resolver";
import { parseRegistry } from "@/lib/service-registry";
import type { ServiceRegistry } from "@/types/service-registry";
import registryJson from "../../public/service-registry.json";

function getRegistry(): ServiceRegistry {
  return parseRegistry(registryJson);
}

describe("dependency-resolver", () => {
  describe("resolveModuleToggle", () => {
    it("enabling a module with no optional dependencies adds only itself", () => {
      const registry = getRegistry();
      const currentEnabled: string[] = [];
      const result = resolveModuleToggle(
        registry,
        currentEnabled,
        "jarvis-ocr-service",
        true,
      );
      expect(result.enabled).toContain("jarvis-ocr-service");
      expect(result.enabled).toHaveLength(1);
    });

    it("enabling recipes adds only itself (no optional deps)", () => {
      const registry = getRegistry();
      const currentEnabled: string[] = [];
      const result = resolveModuleToggle(
        registry,
        currentEnabled,
        "jarvis-recipes-server",
        true,
      );
      expect(result.enabled).toContain("jarvis-recipes-server");
      expect(result.enabled).toHaveLength(1);
    });

    it("disabling a module removes it from enabled list", () => {
      const registry = getRegistry();
      const currentEnabled = ["jarvis-ocr-service", "jarvis-recipes-server"];
      const result = resolveModuleToggle(
        registry,
        currentEnabled,
        "jarvis-recipes-server",
        false,
      );
      expect(result.enabled).not.toContain("jarvis-recipes-server");
      expect(result.enabled).toContain("jarvis-ocr-service");
    });

    it("disabling a module with no dependents has no warnings", () => {
      const registry = getRegistry();
      const currentEnabled = ["jarvis-ocr-service"];
      const result = resolveModuleToggle(
        registry,
        currentEnabled,
        "jarvis-ocr-service",
        false,
      );
      expect(result.warnings).toHaveLength(0);
      expect(result.enabled).not.toContain("jarvis-ocr-service");
    });

    it("enabling multiple modules independently", () => {
      const registry = getRegistry();
      let currentEnabled: string[] = [];

      const r1 = resolveModuleToggle(registry, currentEnabled, "jarvis-whisper-api", true);
      currentEnabled = r1.enabled;

      const r2 = resolveModuleToggle(registry, currentEnabled, "jarvis-tts", true);
      currentEnabled = r2.enabled;

      expect(currentEnabled).toContain("jarvis-whisper-api");
      expect(currentEnabled).toContain("jarvis-tts");
      expect(currentEnabled).toHaveLength(2);
    });
  });

  describe("getRequiredDependencies", () => {
    it("returns empty for services with no optional dependencies", () => {
      const registry = getRegistry();
      const deps = getRequiredDependencies(registry, "jarvis-ocr-service");
      expect(deps).toHaveLength(0);
    });

    it("returns empty for recipes (depends only on core/infra)", () => {
      const registry = getRegistry();
      const deps = getRequiredDependencies(registry, "jarvis-recipes-server");
      expect(deps).toHaveLength(0);
    });

    it("does not include core services or infrastructure in dependencies", () => {
      const registry = getRegistry();
      const deps = getRequiredDependencies(registry, "jarvis-recipes-server");
      expect(deps).not.toContain("postgres");
      expect(deps).not.toContain("jarvis-auth");
      expect(deps).not.toContain("jarvis-config-service");
    });

    it("returns empty for unknown service", () => {
      const registry = getRegistry();
      const deps = getRequiredDependencies(registry, "nonexistent");
      expect(deps).toHaveLength(0);
    });
  });

  describe("validateModuleSelection", () => {
    it("returns valid for a valid selection", () => {
      const registry = getRegistry();
      const enabled = ["jarvis-ocr-service", "jarvis-recipes-server"];
      const result = validateModuleSelection(registry, enabled);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for empty selection", () => {
      const registry = getRegistry();
      const result = validateModuleSelection(registry, []);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for single service (no cross-optional deps)", () => {
      const registry = getRegistry();
      const result = validateModuleSelection(registry, ["jarvis-ocr-service"]);
      expect(result.valid).toBe(true);
    });
  });
});
