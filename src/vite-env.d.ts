/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Cloudflare Web Analytics beacon token. Public (shipped in client JS).
   * Unset = analytics disabled (no-op). Set as a GitHub repo *variable*
   * VITE_CF_BEACON_TOKEN so the deploy build embeds it.
   */
  readonly VITE_CF_BEACON_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
