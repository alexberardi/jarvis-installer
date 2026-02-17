import { describe, it, expect } from "vitest";
import { detectPortConflicts, serviceIdToPortVar, buildPortEntries } from "@/lib/port-utils";
import type { ServiceDefinition, InfrastructureDefinition } from "@/types/service-registry";

describe("port-utils", () => {
  describe("detectPortConflicts", () => {
    it("returns empty map when no conflicts", () => {
      const entries = [
        { id: "a", name: "Service A", port: 8001 },
        { id: "b", name: "Service B", port: 8002 },
      ];
      const conflicts = detectPortConflicts(entries);
      expect(conflicts.size).toBe(0);
    });

    it("detects a port conflict", () => {
      const entries = [
        { id: "a", name: "Service A", port: 8001 },
        { id: "b", name: "Service B", port: 8001 },
      ];
      const conflicts = detectPortConflicts(entries);
      expect(conflicts.size).toBe(1);
      expect(conflicts.get(8001)).toEqual(["Service A", "Service B"]);
    });

    it("detects multiple conflicts", () => {
      const entries = [
        { id: "a", name: "Service A", port: 8001 },
        { id: "b", name: "Service B", port: 8001 },
        { id: "c", name: "Service C", port: 5432 },
        { id: "d", name: "Service D", port: 5432 },
      ];
      const conflicts = detectPortConflicts(entries);
      expect(conflicts.size).toBe(2);
    });

    it("returns empty map for empty input", () => {
      const conflicts = detectPortConflicts([]);
      expect(conflicts.size).toBe(0);
    });
  });

  describe("serviceIdToPortVar", () => {
    it("converts jarvis-auth to AUTH_PORT", () => {
      expect(serviceIdToPortVar("jarvis-auth")).toBe("AUTH_PORT");
    });

    it("converts jarvis-command-center to COMMAND_CENTER_PORT", () => {
      expect(serviceIdToPortVar("jarvis-command-center")).toBe("COMMAND_CENTER_PORT");
    });

    it("converts jarvis-config-service to CONFIG_SERVICE_PORT", () => {
      expect(serviceIdToPortVar("jarvis-config-service")).toBe("CONFIG_SERVICE_PORT");
    });

    it("converts postgres (no jarvis- prefix) to POSTGRES_PORT", () => {
      expect(serviceIdToPortVar("postgres")).toBe("POSTGRES_PORT");
    });

    it("converts jarvis-whisper-api to WHISPER_API_PORT", () => {
      expect(serviceIdToPortVar("jarvis-whisper-api")).toBe("WHISPER_API_PORT");
    });

    it("converts jarvis-recipes-server to RECIPES_SERVER_PORT", () => {
      expect(serviceIdToPortVar("jarvis-recipes-server")).toBe("RECIPES_SERVER_PORT");
    });
  });

  describe("buildPortEntries", () => {
    const services: ServiceDefinition[] = [
      {
        id: "jarvis-auth",
        name: "Auth",
        description: "",
        category: "core",
        port: 8007,
        image: "",
        healthCheck: "/health",
        dependsOn: [],
        envVars: [],
      },
    ];

    const infra: InfrastructureDefinition[] = [
      {
        id: "postgres",
        name: "PostgreSQL",
        description: "",
        image: "",
        port: 5432,
        envVars: [],
        volumes: [],
      },
    ];

    it("builds entries with default ports", () => {
      const entries = buildPortEntries(services, infra, {}, {});
      expect(entries).toHaveLength(2);
      expect(entries[0]).toEqual({ id: "jarvis-auth", name: "Auth", port: 8007 });
      expect(entries[1]).toEqual({ id: "postgres", name: "PostgreSQL", port: 5432 });
    });

    it("applies port overrides for services", () => {
      const entries = buildPortEntries(services, infra, { "jarvis-auth": 9007 }, {});
      expect(entries[0]!.port).toBe(9007);
    });

    it("applies port overrides for infrastructure", () => {
      const entries = buildPortEntries(services, infra, {}, { postgres: 5433 });
      expect(entries[1]!.port).toBe(5433);
    });
  });
});
