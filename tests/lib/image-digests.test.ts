import { describe, it, expect } from "vitest";
import { imageDigestFor } from "@/lib/image-digests";

describe("imageDigestFor", () => {
  const digests = {
    "jarvis-command-center": { latest: "sha256:aaaa", dev: "sha256:bbbb" },
    "jarvis-whisper-api": { "latest-cuda": "sha256:cccc" }, // variant via suffix
  };

  it("returns the digest for (repo, track+suffix)", () => {
    const cc = "ghcr.io/alexberardi/jarvis-command-center";
    expect(imageDigestFor(cc, "latest", "", digests)).toBe("sha256:aaaa");
    expect(imageDigestFor("ghcr.io/alexberardi/jarvis-whisper-api", "latest", "-cuda", digests)).toBe("sha256:cccc");
  });

  it("NEVER pins the dev track — dev exists to run the freshest CI-built images", () => {
    const cc = "ghcr.io/alexberardi/jarvis-command-center";
    // even with a recorded dev digest, dev floats on the tag
    expect(imageDigestFor(cc, "dev", "", digests)).toBeUndefined();
  });

  it("returns undefined when no digest is recorded (graceful fallback in callers)", () => {
    expect(imageDigestFor("ghcr.io/alexberardi/jarvis-tts", "latest", "", digests)).toBeUndefined();
    expect(imageDigestFor("ghcr.io/alexberardi/jarvis-whisper-api", "dev", "-cuda", digests)).toBeUndefined();
  });
});
