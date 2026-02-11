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
    it("enabling recipes auto-enables ocr-service", () => {
      const registry = getRegistry();
      const currentEnabled: string[] = [];
      const result = resolveModuleToggle(
        registry,
        currentEnabled,
        "jarvis-recipes",
        true,
      );
      expect(result.enabled).toContain("jarvis-recipes");
      expect(result.enabled).toContain("jarvis-ocr-service");
    });

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

    it("disabling ocr-service when recipes is enabled produces a warning", () => {
      const registry = getRegistry();
      const currentEnabled = ["jarvis-ocr-service", "jarvis-recipes"];
      const result = resolveModuleToggle(
        registry,
        currentEnabled,
        "jarvis-ocr-service",
        false,
      );
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("jarvis-recipes");
    });

    it("disabling ocr-service when recipes is not enabled has no warnings", () => {
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

    it("disabling a module removes it from enabled list", () => {
      const registry = getRegistry();
      const currentEnabled = ["jarvis-ocr-service", "jarvis-recipes"];
      const result = resolveModuleToggle(
        registry,
        currentEnabled,
        "jarvis-recipes",
        false,
      );
      expect(result.enabled).not.toContain("jarvis-recipes");
    });
  });

  describe("getRequiredDependencies", () => {
    it("returns optional service dependencies for a service", () => {
      const registry = getRegistry();
      const deps = getRequiredDependencies(registry, "jarvis-recipes");
      // recipes depends on ocr-service (optional), and postgres + auth (core/infra - not returned)
      expect(deps).toContain("jarvis-ocr-service");
    });

    it("returns empty array for a service with no optional dependencies", () => {
      const registry = getRegistry();
      const deps = getRequiredDependencies(registry, "jarvis-ocr-service");
      expect(deps).toHaveLength(0);
    });

    it("does not include core services or infrastructure in dependencies", () => {
      const registry = getRegistry();
      const deps = getRequiredDependencies(registry, "jarvis-recipes");
      expect(deps).not.toContain("postgres");
      expect(deps).not.toContain("jarvis-auth");
    });
  });

  describe("validateModuleSelection", () => {
    it("returns no errors for a valid selection", () => {
      const registry = getRegistry();
      const enabled = ["jarvis-ocr-service", "jarvis-recipes"];
      const result = validateModuleSelection(registry, enabled);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns errors when a dependency is missing", () => {
      const registry = getRegistry();
      const enabled = ["jarvis-recipes"]; // missing ocr-service
      const result = validateModuleSelection(registry, enabled);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("jarvis-ocr-service");
    });

    it("returns valid for empty selection", () => {
      const registry = getRegistry();
      const result = validateModuleSelection(registry, []);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("only validates optional service dependencies, not core/infra", () => {
      const registry = getRegistry();
      // ocr-service depends on nothing optional, so it's valid alone
      const result = validateModuleSelection(registry, ["jarvis-ocr-service"]);
      expect(result.valid).toBe(true);
    });
  });
});
