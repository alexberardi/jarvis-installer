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
  | { type: "SET_WHISPER_MODEL"; model: string };
