import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import { generateComposeExport } from "@/lib/compose-export-generator";
import { generateCompose } from "@/lib/compose-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);

// MinIO deleted its Docker Hub repositories. Two nightlies died of it:
//
//   2026-09-11  minio-init is 'running', expected it to have run and exited
//               bucket 'jarvis-recipes' does not exist in MinIO
//   2026-09-12  pull access denied for minio/mc, repository does not exist
//
// The 11th is the more instructive one: the images still pulled, but a new
// :latest changed behaviour under us and the bucket one-shot looped forever.
// The 12th they were gone. Both are the same root cause -- an unpinned tag from
// a registry we do not control -- so these tests pin the registry AND the
// version, not just the registry.

const composeVariants = (): Array<[string, Record<string, { image?: string }>]> => {
  const modules = ["jarvis-recipes-server", "jarvis-ocr-service"];
  const state = makeState({ enabledModules: modules });
  return [
    ["export", (parseYaml(generateComposeExport(state, registry)) as any).services],
    ["sync", (parseYaml(generateCompose(state, registry)) as any).services],
  ];
};

const minioImages = (services: Record<string, { image?: string }>) =>
  Object.entries(services)
    .filter(([id]) => id.startsWith("minio"))
    .map(([id, svc]) => [id, svc.image ?? ""] as const);

describe("the minio images", () => {
  it.each(composeVariants())("%s compose emits minio services", (_name, services) => {
    expect(minioImages(services).length).toBeGreaterThan(0);
  }, 30_000);

  it.each(composeVariants())(
    "%s compose never pulls minio from Docker Hub",
    (_name, services) => {
      for (const [id, image] of minioImages(services)) {
        // A bare "minio/minio" resolves to Docker Hub, where the repository no
        // longer exists.
        expect(image, `${id} has no image`).toBeTruthy();
        expect(image.startsWith("quay.io/"), `${id} pulls ${image}`).toBe(true);
      }
    },
    30_000,
  );

  it.each(composeVariants())(
    "%s compose pins a minio version rather than :latest",
    (_name, services) => {
      for (const [id, image] of minioImages(services)) {
        expect(image.endsWith(":latest"), `${id} follows :latest`).toBe(false);
        // A RELEASE tag, not a digest-less moving target: an upstream change
        // broke the bucket one-shot overnight while :latest still resolved.
        expect(image, `${id} is not pinned to a release`).toMatch(/:RELEASE\.[\d-]+T/);
      }
    },
    30_000,
  );
});

describe("the registry's minio entry", () => {
  it("names quay.io with a pinned release", () => {
    const minio = (registry as any).infrastructure.find((i: any) => i.id === "minio");
    expect(minio).toBeTruthy();
    expect(minio.image).toMatch(/^quay\.io\/minio\/minio:RELEASE\./);
  });
});
