import imageDigests from "@/data/image-digests.json";

/** repo name -> full tag (track+variant suffix, e.g. "latest-cuda") -> "sha256:…" */
export type ImageDigestMap = Record<string, Record<string, string>>;

/**
 * The recorded `@sha256` digest for a first-party image at `(repo, track+suffix)`,
 * or `undefined` when none is recorded (offline / pre-refresh). Pinning by digest
 * makes a generated compose immune to a later GHCR tag overwrite; a missing
 * digest degrades gracefully to the floating tag in the caller.
 *
 * The map is refreshed by jarvis-admin's `refresh-image-digests.mjs --out` after
 * a release publishes images — pinning intentionally freezes images, so a
 * point-in-time map is correct, not stale.
 */
export function imageDigestFor(
  baseImage: string,
  track: string,
  suffix: string,
  digests: ImageDigestMap = imageDigests as ImageDigestMap,
): string | undefined {
  // The dev track ALWAYS floats: it exists to run the freshest CI-built
  // images (install-e2e dev lanes, service-commit dispatches), and a frozen
  // digest silently pins those runs to whatever build existed when the map
  // was last refreshed — CI then "validates" stale code. Digest pinning is
  // for release tracks, where a point-in-time freeze is the point.
  if (track === "dev") return undefined;
  const repo = baseImage.slice(baseImage.lastIndexOf("/") + 1);
  return digests[repo]?.[`${track}${suffix}`];
}
