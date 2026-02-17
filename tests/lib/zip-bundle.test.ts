import { describe, it, expect } from "vitest";
import { generateZipBundle } from "@/lib/zip-bundle";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";
import JSZip from "jszip";

const registry = parseRegistry(registryJson);

describe("zip-bundle", () => {
  it("generates a zip blob", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("contains docker-compose.yml", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files["jarvis/docker-compose.yml"]).toBeDefined();
  });

  it("contains .env file", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files["jarvis/.env"]).toBeDefined();
  });

  it("contains README.md", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files["jarvis/README.md"]).toBeDefined();
  });

  it("contains init-db.sh", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files["jarvis/init-db.sh"]).toBeDefined();
  });

  it("does not contain service-registry.json", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files["jarvis/service-registry.json"]).toBeUndefined();
  });

  it("docker-compose.yml has valid content", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    const content = await zip.files["jarvis/docker-compose.yml"]!.async("string");
    expect(content).toContain("services:");
    expect(content).toContain("jarvis-auth:");
  });

  it(".env has valid content", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    const content = await zip.files["jarvis/.env"]!.async("string");
    expect(content).toContain("AUTH_SECRET_KEY=");
    expect(content).toContain("DB_USER=jarvis");
  });

  it("init-db.sh has valid content", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    const content = await zip.files["jarvis/init-db.sh"]!.async("string");
    expect(content).toContain("#!/bin/bash");
    expect(content).toContain("CREATE DATABASE");
  });
});
