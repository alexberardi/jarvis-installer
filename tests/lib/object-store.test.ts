/**
 * The object store as optional infrastructure, and the bucket that has to exist.
 *
 * The S3 API does not create a bucket on first write. Without the init one-shot
 * the object store runs perfectly and the first upload fails with a
 * config-shaped error — which is precisely how recipes photo import failed for
 * days while the store sat there healthy and empty.
 *
 * The store is SeaweedFS as of 2026-09-30. MinIO archived the OSS project and
 * closed every distribution channel; see prds/minio-eol-object-store.md.
 */
import { describe, expect, it } from "vitest";
import registry from "../../public/service-registry.json";
import { parse } from "yaml";
import { generateCompose } from "../../src/lib/compose-generator";
import { generateComposeExport } from "../../src/lib/compose-export-generator";
import { getRequiredInfrastructure } from "../../src/lib/service-registry";
import { makeState } from "../helpers/make-state";

const compose = (modules: string[]) =>
  generateCompose(makeState({ enabledModules: modules } as any), registry as any);

const infraIds = (modules: string[]) =>
  getRequiredInfrastructure(registry as any, modules).map((i) => i.id);

describe("the object store is provisioned only when something needs it", () => {
  it("is absent from a stack that stores no objects", () => {
    // "Optional infrastructure" is the existing dependsOn mechanism, not a new
    // flag: nothing declares it, nothing runs it.
    expect(infraIds(["jarvis-auth"])).not.toContain("seaweedfs");
    expect(compose(["jarvis-auth"])).not.toContain("seaweedfs:");
  });

  it("is pulled in by a service that declares a bucket", () => {
    expect(infraIds(["jarvis-recipes-server"])).toContain("seaweedfs");
  });
});

describe("the generated object store", () => {
  const yaml = compose(["jarvis-recipes-server", "jarvis-ocr-service"]);

  it("binds the S3 port to localhost", () => {
    // The S3 API reads and writes every uploaded image in the install; it has
    // no business being reachable from the LAN by default.
    for (const line of yaml.split("\n").filter((l) => l.includes(":8333"))) {
      if (line.trim().startsWith("- ")) {
        expect(line).toContain("${JARVIS_INFRA_BIND_HOST:-127.0.0.1}");
      }
    }
  });

  it("publishes no second port", () => {
    // MinIO shipped a web console on 9001 and it had to be bound as carefully
    // as the data port. SeaweedFS serves no S3 console, so that login surface
    // is simply gone — assert it stays gone rather than silently returning.
    expect(yaml).not.toContain(":9001");
    expect(yaml).not.toContain("PORT_CONSOLE");
  });

  it("writes its S3 credentials from the generated secrets", () => {
    // `weed -s3.config` takes a FILE PATH, not env vars, so the identity file
    // is materialised at start. `$$` is compose's escape: the SHELL expands
    // these, not compose.
    expect(yaml).toContain("$$OBJECT_STORE_ACCESS_KEY");
    expect(yaml).toContain("$$OBJECT_STORE_SECRET_KEY");
    expect(yaml).toContain("/etc/seaweedfs/s3.json");
    expect(yaml).toContain('entrypoint: ["/bin/sh", "-c"]');
  });

  it("gives the store enough volume slots to actually accept writes", () => {
    // -volume.max defaults to 8, and SeaweedFS makes a separate volume
    // collection PER BUCKET, growing them 7 at a time. A single-node install
    // exhausts the slots and every PutObject returns InternalError
    // ("No writable volumes ... Not enough data nodes found!"). `0` is a trap:
    // it auto-sizes from free disk / volume size and resolved to 2 in a
    // container. Verified 2026-10-01 by migrating a seeded MinIO bucket --
    // 8 of 9 objects failed until this was set.
    expect(yaml).toContain("-volume.max=64");
    expect(yaml).not.toContain("-volume.max=0");
  });

  it("creates the bucket each service asked for", () => {
    expect(yaml).toContain("s3.bucket.create -name jarvis-recipes");
  });

  it("verifies the bucket instead of trusting the exit code", () => {
    // `s3.bucket.create` prints "already exists" and STILL EXITS 0 — which
    // means it also exits 0 when it genuinely fails. Verified against the real
    // image 2026-09-30. Without this check the one-shot goes green having
    // created nothing, which is the exact failure the one-shot exists to stop.
    expect(yaml).toMatch(/s3\.bucket\.list[\s\S]*?grep -q "jarvis-recipes"/);
    expect(yaml).toContain("exit 1");
  });

  it("waits for the store rather than assuming it is up", () => {
    // compose `depends_on` only waits for the container to START. The one-shot
    // runs immediately and gets connection refused.
    expect(yaml).toMatch(/until echo "s3\.bucket\.list"[\s\S]*?sleep 2/);
  });

  it("runs the init one-shot on the store's own image", () => {
    // `weed shell` ships in the server image, so there is no second image to
    // pin. The old `mc` one-shot was half the MinIO blast radius — its Docker
    // Hub repo vanished a day after the server's did.
    const doc = parse(yaml) as { services: Record<string, { image?: string }> };
    expect(doc.services["seaweedfs-init"]?.image).toBe(doc.services["seaweedfs"]?.image);
  });

  it("does not restart the init one-shot forever", () => {
    // It does its work and exits 0; unless-stopped would have compose recreate
    // it in a loop.
    const block = yaml.split("\n\n").find((b) => b.includes("seaweedfs-init:")) ?? "";
    expect(block).toContain("restart: on-failure");
    expect(block).not.toContain("restart: unless-stopped");
  });
});

describe("the recipes services", () => {
  const yaml = compose(["jarvis-recipes-server", "jarvis-ocr-service"]);

  it("point at the object store over the compose network", () => {
    expect(yaml).toContain("S3_ENDPOINT_URL: http://seaweedfs:8333");
  });

  it("use path-style addressing, which SeaweedFS requires", () => {
    // Virtual-host style is the boto3 default and SeaweedFS does not serve it.
    expect(yaml).toContain("S3_FORCE_PATH_STYLE: true");
  });

  it("give each OCR host its own queue", () => {
    // Recipes fans an image out to every OCR host; a shared queue name has them
    // race and only one reads each image.
    expect(yaml).toContain("OCR_QUEUE_NAME: jarvis.ocr.jobs.linux");
    // OCR_QUEUES is operator-settable so a second OCR host can be added per
    // install (an Apple Vision worker on a Mac reads handwriting the Linux
    // providers cannot). The DEFAULT must still be the queue this install's
    // own worker consumes: adding a host stays opt-in.
    expect(yaml).toContain("OCR_QUEUES: ${OCR_QUEUES:-jarvis.ocr.jobs.linux}");
  });

  it("run their queue workers alongside the API", () => {
    expect(yaml).toContain("jarvis-recipes-worker:");
    expect(yaml).toContain("jarvis-ocr-worker:");
  });
});

// ── the export path ──────────────────────────────────────────────────────────
//
// There are TWO generators over the same registry: the admin SYNC path
// (generateCompose, above) and the installer's own artifact
// (generateComposeExport). Everything above tested only the first, so the object
// store once went out with the export emitting `depends_on: minio` and no minio
// service — `docker compose config` rejected the whole project, and only
// install-e2e saw it.

describe("the exported artifact", () => {
  const exported = () =>
    generateComposeExport(
      makeState({
        enabledModules: ["jarvis-recipes-server", "jarvis-ocr-service"],
      } as any),
      registry as any,
    );

  it("emits the object store the recipes services depend on", () => {
    const yaml = exported();
    expect(yaml).toContain("  seaweedfs:");
    // The repository and pinning live in tests/lib/object-store-image.test.ts,
    // which asserts the property (pinned by digest) rather than a literal.
    // Pinning the literal here is what made a registry move a two-file change.
    expect(yaml).toMatch(/image: \S*seaweedfs\S+/);
  });

  it("creates the bucket in the export too", () => {
    expect(exported()).toContain("s3.bucket.create -name jarvis-recipes");
  });

  it("verifies the bucket in the export too", () => {
    expect(exported()).toMatch(/s3\.bucket\.list[\s\S]*?grep -q "jarvis-recipes"/);
  });

  it("never depends on a service it did not emit", () => {
    // The general invariant, not just for the object store. This is exactly
    // what `docker compose config` rejects, and the only reason it took an e2e
    // run to notice is that nothing asserted it here.
    const doc = parse(exported()) as { services: Record<string, any> };
    const defined = new Set(Object.keys(doc.services));

    for (const [name, service] of Object.entries(doc.services)) {
      const deps = Array.isArray(service.depends_on)
        ? service.depends_on
        : Object.keys(service.depends_on ?? {});
      for (const dep of deps) {
        expect(defined, `${name} depends on undefined service "${dep}"`).toContain(dep);
      }
    }
  });

  it("is valid YAML", () => {
    expect(() => parse(exported())).not.toThrow();
  });
});
