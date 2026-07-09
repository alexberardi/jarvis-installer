import { describe, it, expect, afterEach, vi } from "vitest";
import { initAnalytics } from "@/lib/analytics";

afterEach(() => {
  vi.unstubAllEnvs();
  document.querySelectorAll("script[data-cf-beacon]").forEach((s) => s.remove());
});

describe("initAnalytics", () => {
  it("is a no-op when no token is configured (freeze-safe default)", () => {
    vi.stubEnv("VITE_CF_BEACON_TOKEN", "");
    initAnalytics();
    expect(document.querySelector("script[data-cf-beacon]")).toBeNull();
  });

  it("injects the Cloudflare beacon with the token when configured", () => {
    vi.stubEnv("VITE_CF_BEACON_TOKEN", "abc123");
    initAnalytics();
    const s = document.querySelector("script[data-cf-beacon]") as HTMLScriptElement | null;
    expect(s).not.toBeNull();
    expect(s!.src).toContain("static.cloudflareinsights.com/beacon.min.js");
    expect(s!.getAttribute("data-cf-beacon")).toContain("abc123");
    expect(s!.defer).toBe(true);
  });

  it("does not double-inject on repeated calls", () => {
    vi.stubEnv("VITE_CF_BEACON_TOKEN", "abc123");
    initAnalytics();
    initAnalytics();
    expect(document.querySelectorAll("script[data-cf-beacon]").length).toBe(1);
  });
});
