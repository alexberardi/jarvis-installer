export type GpuType = "nvidia" | "amd" | "amd-rocm" | "none";

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
  llmInterface: string;

  // Deployment mode
  deploymentTarget: "standard" | "compose-export";
  storagePath: string;
  gpuEnabled: boolean;
  gpuType: GpuType;
  /** In-flight Jarvis Relay integration. Optional until the full feature lands. */
  relayEnabled?: boolean;
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
  | { type: "SET_LLM_INTERFACE"; interfaceId: string }
  | { type: "SET_DEPLOYMENT_TARGET"; target: "standard" | "compose-export" }
  | { type: "SET_STORAGE_PATH"; path: string }
  | { type: "SET_GPU_ENABLED"; enabled: boolean }
  | { type: "SET_GPU_TYPE"; gpuType: GpuType };
