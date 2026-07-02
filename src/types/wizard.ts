export type GpuType = "nvidia" | "amd" | "amd-rocm" | "none";

/**
 * Whisper GPU backend, chosen explicitly and independently of the LLM's gpuType.
 * Default "cpu" — Whisper's base.en is fast on CPU and leaves the GPU for the LLM.
 * Maps to the whisper image suffix: cpu "" / cuda "-cuda" / vulkan "-vulkan" / rocm "-rocm".
 */
export type WhisperBackend = "cpu" | "cuda" | "vulkan" | "rocm";

export interface WizardState {
  currentStep: number;
  totalSteps: number;

  // Step 1: Services
  enabledModules: string[];

  // Step 2: Configuration
  portOverrides: Record<string, number>;
  infraPortOverrides: Record<string, number>;
  secrets: Record<string, string>;
  dbUser: string;
  whisperModel: string;
  whisperBackend: WhisperBackend;
  llmInterface: string;

  // Deployment mode
  deploymentTarget: "standard" | "compose-export";
  storagePath: string;
  gpuEnabled: boolean;
  gpuType: GpuType;
  relayEnabled: boolean;
  relayUrl: string;
  /**
   * Household JWT for jarvis-notifications → relay /v1/send. Signed by the
   * relay's RELAY_JWT_SECRET; carries household_id and an expiry. Without it
   * the notifications service can't authenticate to the relay and push
   * delivery silently no-ops.
   */
  relayHouseholdJwt?: string;
  releaseTrack: "stable" | "dev";
}

export type WizardAction =
  | { type: "SET_STEP"; step: number }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_ENABLED_MODULES"; modules: string[] }
  | { type: "TOGGLE_MODULE"; serviceId: string; enabled: boolean }
  | { type: "SET_PORT_OVERRIDE"; serviceId: string; port: number }
  | { type: "SET_INFRA_PORT_OVERRIDE"; infraId: string; port: number }
  | { type: "SET_SECRET"; name: string; value: string }
  | { type: "REGENERATE_SECRETS"; secrets: Record<string, string> }
  | { type: "SET_DB_USER"; user: string }
  | { type: "SET_WHISPER_MODEL"; model: string }
  | { type: "SET_WHISPER_BACKEND"; backend: WhisperBackend }
  | { type: "SET_LLM_INTERFACE"; interfaceId: string }
  | { type: "SET_DEPLOYMENT_TARGET"; target: "standard" | "compose-export" }
  | { type: "SET_STORAGE_PATH"; path: string }
  | { type: "SET_GPU_ENABLED"; enabled: boolean }
  | { type: "SET_GPU_TYPE"; gpuType: GpuType }
  | { type: "SET_RELAY_ENABLED"; enabled: boolean }
  | { type: "SET_RELAY_URL"; url: string }
  | { type: "SET_RELEASE_TRACK"; track: "stable" | "dev" };
