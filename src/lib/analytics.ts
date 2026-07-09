// Cloudflare Web Analytics — a privacy-friendly, cookieless beacon that
// measures ACTUAL human page loads. Unlike GitHub clone counts (which are
// dominated by CI/scanner/mirror bots — 8k clones vs ~10 human page views in
// July 2026), the beacon only fires in a real browser, so it cleanly separates
// people from automation.
//
// No-op by default: with no VITE_CF_BEACON_TOKEN the function returns
// immediately, so builds without the token (local dev, forks, pre-setup) ship
// zero tracking. The token is public by design — it's embedded in the client
// beacon — so it lives in a build-time env var / CI repo variable, not a secret.
export function initAnalytics(): void {
  const token = import.meta.env.VITE_CF_BEACON_TOKEN?.trim();
  if (!token) return;
  // Idempotent: guard against HMR / double-invoke re-injecting the beacon.
  if (document.querySelector("script[data-cf-beacon]")) return;

  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  document.head.appendChild(s);
}
