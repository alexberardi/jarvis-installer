/**
 * Generates a cryptographically secure hex string.
 * Uses crypto.getRandomValues() available in all modern browsers.
 */
export function generateHexSecret(byteLength: number = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const SECRET_KEYS = [
  "AUTH_SECRET_KEY",
  "JARVIS_CONFIG_ADMIN_TOKEN",
  "JARVIS_AUTH_ADMIN_TOKEN",
  "POSTGRES_PASSWORD",
  "REDIS_PASSWORD",
  "ADMIN_API_KEY",
  "GRAFANA_ADMIN_PASSWORD",
  // Internal auth between the llm-proxy API/worker and its model service
  // (port 7705). The model service fails closed: with no token it 503s every
  // inference call while /health stays green.
  "MODEL_SERVICE_TOKEN",
  // Shared MQTT broker credential (username is the literal 'jarvis'). The
  // mosquitto container hashes this into a password_file at startup; command-
  // center authenticates with it and hands it to nodes. 'PASSWORD' -> 16B/32hex.
  "MQTT_PASSWORD",
  // CC-internal auth for async-job result callbacks (memory extraction, deep
  // research, characterization synthesis, adapter training). CC signs the enqueue
  // + validates the /…/callback (fail-closed): unset -> every callback 503s and
  // the persist step (save_memory, transcript mark_processed, inbox delivery)
  // never runs. No 'PASSWORD' in the name -> 32 bytes / 64 hex.
  "JARVIS_ADAPTER_CALLBACK_TOKEN",
] as const;

export type SecretKey = (typeof SECRET_KEYS)[number];

/**
 * Generates all required secrets.
 * Passwords get 16 bytes (32 hex chars), auth secrets get 32 bytes (64 hex chars).
 */
export function generateAllSecrets(): Record<SecretKey, string> {
  const secrets: Record<string, string> = {};
  for (const key of SECRET_KEYS) {
    const byteLength = key.includes("PASSWORD") ? 16 : 32;
    secrets[key] = generateHexSecret(byteLength);
  }
  return secrets as Record<SecretKey, string>;
}
