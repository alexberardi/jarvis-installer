import { describe, it, expect } from "vitest";
import { generateHexSecret, generateAllSecrets, SECRET_KEYS } from "@/lib/secret-generator";

describe("secret-generator", () => {
  describe("generateHexSecret", () => {
    it("generates a hex string of correct length", () => {
      const secret = generateHexSecret(32);
      expect(secret).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it("generates only hex characters", () => {
      const secret = generateHexSecret(16);
      expect(secret).toMatch(/^[0-9a-f]+$/);
    });

    it("generates different values each time", () => {
      const a = generateHexSecret(32);
      const b = generateHexSecret(32);
      expect(a).not.toBe(b);
    });

    it("defaults to 32 bytes", () => {
      const secret = generateHexSecret();
      expect(secret).toHaveLength(64);
    });
  });

  describe("generateAllSecrets", () => {
    it("generates a secret for every key", () => {
      const secrets = generateAllSecrets();
      for (const key of SECRET_KEYS) {
        expect(secrets[key]).toBeDefined();
        expect(secrets[key].length).toBeGreaterThan(0);
      }
    });

    it("password secrets are 32 hex chars (16 bytes)", () => {
      const secrets = generateAllSecrets();
      expect(secrets.POSTGRES_PASSWORD).toHaveLength(32);
      expect(secrets.REDIS_PASSWORD).toHaveLength(32);
    });

    it("auth secrets are 64 hex chars (32 bytes)", () => {
      const secrets = generateAllSecrets();
      expect(secrets.AUTH_SECRET_KEY).toHaveLength(64);
      expect(secrets.JARVIS_CONFIG_ADMIN_TOKEN).toHaveLength(64);
      expect(secrets.JARVIS_AUTH_ADMIN_TOKEN).toHaveLength(64);
      expect(secrets.ADMIN_API_KEY).toHaveLength(64);
    });

    it("all values are valid hex", () => {
      const secrets = generateAllSecrets();
      for (const key of SECRET_KEYS) {
        expect(secrets[key]).toMatch(/^[0-9a-f]+$/);
      }
    });
  });

  describe("SECRET_KEYS", () => {
    it("contains expected keys", () => {
      expect(SECRET_KEYS).toContain("AUTH_SECRET_KEY");
      expect(SECRET_KEYS).toContain("JARVIS_CONFIG_ADMIN_TOKEN");
      expect(SECRET_KEYS).toContain("JARVIS_AUTH_ADMIN_TOKEN");
      expect(SECRET_KEYS).toContain("POSTGRES_PASSWORD");
      expect(SECRET_KEYS).toContain("REDIS_PASSWORD");
      expect(SECRET_KEYS).toContain("ADMIN_API_KEY");
    });
  });
});
