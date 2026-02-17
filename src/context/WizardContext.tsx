import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from "react";
import type { WizardState, WizardAction } from "@/types/wizard";

const TOTAL_STEPS = 3;

const initialState: WizardState = {
  currentStep: 0,
  totalSteps: TOTAL_STEPS,
  inferenceMode: "gpu",
  detectedGpu: null,
  vramMb: 0,
  ramGb: 16,
  recommendation: null,
  wakeWord: "jarvis",
  enabledModules: [],
  outputMode: "command",
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: clamp(action.step, 0, state.totalSteps - 1) };
    case "NEXT_STEP":
      return { ...state, currentStep: Math.min(state.currentStep + 1, state.totalSteps - 1) };
    case "PREV_STEP":
      return { ...state, currentStep: Math.max(state.currentStep - 1, 0) };
    case "SET_INFERENCE_MODE":
      return { ...state, inferenceMode: action.mode };
    case "SET_DETECTED_GPU":
      return { ...state, detectedGpu: action.gpu };
    case "SET_VRAM":
      return { ...state, vramMb: action.vramMb };
    case "SET_RAM":
      return { ...state, ramGb: action.ramGb };
    case "SET_RECOMMENDATION":
      return { ...state, recommendation: action.recommendation };
    case "SET_WAKE_WORD":
      return { ...state, wakeWord: action.wakeWord };
    case "SET_ENABLED_MODULES":
      return { ...state, enabledModules: action.modules };
    case "TOGGLE_MODULE": {
      if (action.enabled) {
        const modules = state.enabledModules.includes(action.serviceId)
          ? state.enabledModules
          : [...state.enabledModules, action.serviceId];
        return { ...state, enabledModules: modules };
      }
      return {
        ...state,
        enabledModules: state.enabledModules.filter((m) => m !== action.serviceId),
      };
    }
    case "SET_OUTPUT_MODE":
      return { ...state, outputMode: action.mode };
    default:
      return state;
  }
}

interface WizardContextValue {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  return (
    <WizardContext.Provider value={{ state, dispatch }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizard must be used within a WizardProvider");
  }
  return context;
}
