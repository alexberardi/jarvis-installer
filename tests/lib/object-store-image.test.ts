import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import { generateComposeExport } from "@/lib/compose-export-generator";
import { generateCompose } from "@/lib/compose-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);

// Replaces tests/lib/minio-image.test.ts. MinIO deleted its Docker Hub
// repositories, then archived the whole OSS project and closed every remaining
// channel. Three nightlies died of it:
//
//   2026-09-11  minio-init is 'running', expected it to have run and exited
//               bucket 'jarvis-recipes' does not exist in MinIO
//   2026-09-12  pull access denied for minio/mc, repository does not exist
//   ~2026-09-25 quay.io/minio/* unauthorized for anonymous pulls
//
// The 11th is the most instructive: the images still pulled, but a new :latest
// changed behaviour under us and the bucket one-shot looped forever. The 12th
// they were gone from Docker Hub. The 25th the fallback registry closed too.
//
// Every one of those is the same root cause — a MOVING reference into a
// registry we do not control — so this pins the strongest thing available: a
// digest, which cannot move at all. A tag can be repointed; a digest cannot.
//
// See prds/minio-eol-object-store.md.

const composeVariants = (): Array<[string, Record<string, { image?: string }>]> => {
  const modules = ["jarvis-recipes-server", "jarvis-ocr-service"];
  const state = makeState({ enabledModules: modules });
  return [
    ["export", (parseYaml(generateComposeExport(state, registry)) as any).services],
    ["sync", (parseYaml(generateCompose(state, registry)) as any).services],
  ];
};

const objectStoreImages = (services: Record<string, { image?: string }>) =>
  Object.entries(services)
    .filter(([id]) => id.startsWith("seaweedfs"))
    .map(([id, svc]) => [id, svc.image ?? ""] as const);

describe("the object store images", () => {
  it.each(composeVariants())(
    "%s compose emits object store services",
    (_name, services) => {
      expect(objectStoreImages(services).length).toBeGreaterThan(0);
    },
    30_000,
  );

  it.each(composeVariants())(
    "%s compose pins by digest rather than a moving tag",
    (_name, services) => {
      for (const [id, image] of objectStoreImages(services)) {
        expect(image, `${id} has no image`).toBeTruthy();
        expect(image.endsWith(":latest"), `${id} follows :latest`).toBe(false);
        // The whole lesson of the MinIO outage in one assertion.
        expect(image, `${id} is not digest-pinned: ${image}`).toMatch(
          /@sha256:[0-9a-f]{64}$/,
        );
      }
    },
    30_000,
  );

  it.each(composeVariants())(
    "%s compose runs the init one-shot on the same image as the store",
    (_name, services) => {
      // Two images meant two ways to lose the object store; `mc` disappeared a
      // day after the server did. `weed shell` ships in the server image, so
      // there is exactly one reference to keep alive now.
      const images = new Set(objectStoreImages(services).map(([, image]) => image));
      expect(images.size, `expected one image, got ${[...images].join(", ")}`).toBe(1);
    },
    30_000,
  );
});

describe("the registry's object store entry", () => {
  it("is SeaweedFS, pinned by digest", () => {
    const store = (registry as any).infrastructure.find((i: any) => i.id === "seaweedfs");
    expect(store).toBeTruthy();
    expect(store.image).toMatch(/^chrislusf\/seaweedfs@sha256:[0-9a-f]{64}$/);
  });

  it("no longer carries a MinIO entry", () => {
    const ids = (registry as any).infrastructure.map((i: any) => i.id);
    expect(ids).not.toContain("minio");
  });
});
