import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { WizardProvider, useWizard } from "@/context/WizardContext";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <WizardProvider>{children}</WizardProvider>;
}

describe("WizardContext", () => {
  describe("initial state", () => {
    it("starts at step 0 with 3 total steps", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      expect(result.current.state.currentStep).toBe(0);
      expect(result.current.state.totalSteps).toBe(3);
    });

    it("defaults to gpu inference mode", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      expect(result.current.state.inferenceMode).toBe("gpu");
    });

    it("defaults to no detected GPU", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      expect(result.current.state.detectedGpu).toBeNull();
    });

    it("defaults to empty enabled modules", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      expect(result.current.state.enabledModules).toEqual([]);
    });

    it("defaults to command output mode", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      expect(result.current.state.outputMode).toBe("command");
    });
  });

  describe("step navigation", () => {
    it("advances to next step", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "NEXT_STEP" }));
      expect(result.current.state.currentStep).toBe(1);
    });

    it("goes back to previous step", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "NEXT_STEP" }));
      act(() => result.current.dispatch({ type: "PREV_STEP" }));
      expect(result.current.state.currentStep).toBe(0);
    });

    it("does not go below step 0", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "PREV_STEP" }));
      expect(result.current.state.currentStep).toBe(0);
    });

    it("does not go above totalSteps - 1", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      // Go to last step
      act(() => result.current.dispatch({ type: "SET_STEP", step: 2 }));
      act(() => result.current.dispatch({ type: "NEXT_STEP" }));
      expect(result.current.state.currentStep).toBe(2);
    });

    it("sets step directly", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "SET_STEP", step: 2 }));
      expect(result.current.state.currentStep).toBe(2);
    });

    it("clamps SET_STEP to valid bounds", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "SET_STEP", step: 99 }));
      expect(result.current.state.currentStep).toBe(2);
      act(() => result.current.dispatch({ type: "SET_STEP", step: -5 }));
      expect(result.current.state.currentStep).toBe(0);
    });
  });

  describe("hardware actions", () => {
    it("sets inference mode", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "SET_INFERENCE_MODE", mode: "cpu" }));
      expect(result.current.state.inferenceMode).toBe("cpu");
    });

    it("sets detected GPU", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      const gpu = { name: "RTX 4090", vendor: "NVIDIA", vramMb: 24576, source: "webgl" as const };
      act(() => result.current.dispatch({ type: "SET_DETECTED_GPU", gpu }));
      expect(result.current.state.detectedGpu).toEqual(gpu);
    });

    it("sets VRAM", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "SET_VRAM", vramMb: 8192 }));
      expect(result.current.state.vramMb).toBe(8192);
    });

    it("sets RAM", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "SET_RAM", ramGb: 32 }));
      expect(result.current.state.ramGb).toBe(32);
    });

    it("sets recommendation", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      const rec = {
        modelId: "test-model",
        modelName: "Test Model",
        quantization: "q4_k_m",
        gpuLayers: "all" as const,
        estimatedVramMb: 5000,
        tier: "medium" as const,
        description: "Test",
      };
      act(() => result.current.dispatch({ type: "SET_RECOMMENDATION", recommendation: rec }));
      expect(result.current.state.recommendation).toEqual(rec);
    });
  });

  describe("wake word", () => {
    it("sets wake word", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "SET_WAKE_WORD", wakeWord: "hey jarvis" }));
      expect(result.current.state.wakeWord).toBe("hey jarvis");
    });
  });

  describe("module actions", () => {
    it("sets enabled modules", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() =>
        result.current.dispatch({
          type: "SET_ENABLED_MODULES",
          modules: ["jarvis-recipes", "jarvis-ocr-service"],
        }),
      );
      expect(result.current.state.enabledModules).toEqual(["jarvis-recipes", "jarvis-ocr-service"]);
    });

    it("toggles a module on", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() =>
        result.current.dispatch({ type: "TOGGLE_MODULE", serviceId: "jarvis-ocr-service", enabled: true }),
      );
      expect(result.current.state.enabledModules).toContain("jarvis-ocr-service");
    });

    it("toggles a module off", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() =>
        result.current.dispatch({
          type: "SET_ENABLED_MODULES",
          modules: ["jarvis-ocr-service", "jarvis-recipes"],
        }),
      );
      act(() =>
        result.current.dispatch({ type: "TOGGLE_MODULE", serviceId: "jarvis-recipes", enabled: false }),
      );
      expect(result.current.state.enabledModules).not.toContain("jarvis-recipes");
    });

    it("does not duplicate module when toggling on twice", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() =>
        result.current.dispatch({ type: "TOGGLE_MODULE", serviceId: "jarvis-ocr-service", enabled: true }),
      );
      act(() =>
        result.current.dispatch({ type: "TOGGLE_MODULE", serviceId: "jarvis-ocr-service", enabled: true }),
      );
      const count = result.current.state.enabledModules.filter(
        (m) => m === "jarvis-ocr-service",
      ).length;
      expect(count).toBe(1);
    });
  });

  describe("output mode", () => {
    it("sets output mode to bundle", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "SET_OUTPUT_MODE", mode: "bundle" }));
      expect(result.current.state.outputMode).toBe("bundle");
    });
  });
});
