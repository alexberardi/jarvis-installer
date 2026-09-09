/**
 * MinIO as optional infrastructure, and the bucket that has to exist.
 *
 * MinIO does not create a bucket on first write. Without the init one-shot the
 * object store runs perfectly and the first upload fails with a config-shaped
 * error — which is precisely how recipes photo import failed for days while
 * MinIO sat there healthy and empty.
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

describe("MinIO is provisioned only when something needs it", () => {
  it("is absent from a stack that stores no objects", () => {
    // "Optional infrastructure" is the existing dependsOn mechanism, not a new
    // flag: nothing declares it, nothing runs it.
    expect(infraIds(["jarvis-auth"])).not.toContain("minio");
    expect(compose(["jarvis-auth"])).not.toContain("minio/minio");
  });

  it("is pulled in by a service that declares a bucket", () => {
    expect(infraIds(["jarvis-recipes-server"])).toContain("minio");
  });
});

describe("the generated object store", () => {
  const yaml = compose(["jarvis-recipes-server", "jarvis-ocr-service"]);

  it("publishes the console on its own port", () => {
    expect(yaml).toContain("${MINIO_PORT_CONSOLE:-9001}:9001");
  });

  it("binds both ports to localhost", () => {
    // A console reachable from the LAN is a login form for every uploaded image
    // in the install.
    for (const line of yaml.split("\n").filter((l) => l.includes(":9000") || l.includes(":9001"))) {
      if (line.trim().startsWith("- ")) {
        expect(line).toContain("${JARVIS_INFRA_BIND_HOST:-127.0.0.1}");
      }
    }
  });

  it("creates the bucket each service asked for", () => {
    expect(yaml).toContain("mc mb --ignore-existing local/jarvis-recipes");
  });

  it("waits for MinIO rather than assuming it is up", () => {
    // compose `depends_on` only waits for the container to START. mc runs
    // immediately and gets connection refused.
    expect(yaml).toMatch(/until mc alias set local[\s\S]*?sleep 2/);
  });

  it("quotes the credentials so a password with spaces survives", () => {
    // Generated secrets are hex today, but the value is operator-editable and a
    // folded `sh -c "..."` block collided its own quotes.
    expect(yaml).toContain('"$$MINIO_ROOT_USER" "$$MINIO_ROOT_PASSWORD"');
    expect(yaml).toContain('entrypoint: ["/bin/sh", "-c"]');
  });

  it("does not restart the init one-shot forever", () => {
    // It does its work and exits 0; unless-stopped would have compose recreate
    // it in a loop.
    const block = yaml.split("\n\n").find((b) => b.includes("minio-init:")) ?? "";
    expect(block).toContain("restart: on-failure");
    expect(block).not.toContain("restart: unless-stopped");
  });
});

describe("the recipes services", () => {
  const yaml = compose(["jarvis-recipes-server", "jarvis-ocr-service"]);

  it("point at MinIO over the compose network", () => {
    expect(yaml).toContain("S3_ENDPOINT_URL: http://minio:9000");
  });

  it("use path-style addressing, which MinIO requires", () => {
    // Virtual-host style is the boto3 default and MinIO does not serve it.
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
// (generateComposeExport). Everything above tested only the first, so MinIO went
// out with the export emitting `depends_on: minio` and no minio service --
// `docker compose config` rejected the whole project, and only install-e2e saw
// it.

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
    expect(yaml).toContain("  minio:");
    expect(yaml).toContain("minio/minio:latest");
  });

  it("creates the bucket in the export too", () => {
    expect(exported()).toContain("mc mb --ignore-existing local/jarvis-recipes");
  });

  it("never depends on a service it did not emit", () => {
    // The general invariant, not just for MinIO. This is exactly what
    // `docker compose config` rejects, and the only reason it took an e2e run
    // to notice is that nothing asserted it here.
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
