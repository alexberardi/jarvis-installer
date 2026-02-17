import type { InferenceMode, DetectedGpu, ModelRecommendation } from "./hardware";

export interface WizardState {
  currentStep: number;
  totalSteps: number;

  // Step 1: Hardware
  inferenceMode: InferenceMode;
  detectedGpu: DetectedGpu | null;
  vramMb: number;
  ramGb: number;
  recommendation: ModelRecommendation | null;

  // Step 2: Modules
  wakeWord: string;

  // Step 3: Modules
  enabledModules: string[];

  // Step 4: Output
  outputMode: "command" | "bundle";
}

export type WizardAction =
  | { type: "SET_STEP"; step: number }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_INFERENCE_MODE"; mode: InferenceMode }
  | { type: "SET_DETECTED_GPU"; gpu: DetectedGpu | null }
  | { type: "SET_VRAM"; vramMb: number }
  | { type: "SET_RAM"; ramGb: number }
  | { type: "SET_RECOMMENDATION"; recommendation: ModelRecommendation }
  | { type: "SET_WAKE_WORD"; wakeWord: string }
  | { type: "SET_ENABLED_MODULES"; modules: string[] }
  | { type: "TOGGLE_MODULE"; serviceId: string; enabled: boolean }
  | { type: "SET_OUTPUT_MODE"; mode: "command" | "bundle" };
