import { useEffect } from "react";
import { useWizard } from "@/context/WizardContext";
import { detectGpu } from "@/lib/gpu-detect";
import { getModelRecommendation } from "@/lib/hardware-advisor";
import type { HardwareProfile } from "@/types/hardware";

export default function HardwareStep() {
  const { state, dispatch } = useWizard();
  const { inferenceMode, vramMb, ramGb, recommendation } = state;

  // Auto-detect GPU on mount
  useEffect(() => {
    detectGpu().then((gpu) => {
      if (gpu) {
        dispatch({ type: "SET_DETECTED_GPU", gpu });
        if (gpu.vramMb) {
          dispatch({ type: "SET_VRAM", vramMb: gpu.vramMb });
        }
      }
    });
  }, [dispatch]);

  // Update recommendation when hardware params change
  useEffect(() => {
    const profile: HardwareProfile = {
      mode: inferenceMode,
      gpu: state.detectedGpu,
      vramMb,
      ramGb,
    };
    const rec = getModelRecommendation(profile);
    dispatch({ type: "SET_RECOMMENDATION", recommendation: rec });
  }, [inferenceMode, vramMb, ramGb, state.detectedGpu, dispatch]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Hardware Configuration</h2>

      {/* Inference mode toggle */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--color-text-secondary)]">
          Inference Mode
        </legend>
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="inference-mode"
              value="gpu"
              checked={inferenceMode === "gpu"}
              onChange={() => dispatch({ type: "SET_INFERENCE_MODE", mode: "gpu" })}
              aria-label="GPU"
              className="accent-[var(--color-accent)]"
            />
            <span>GPU</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="inference-mode"
              value="cpu"
              checked={inferenceMode === "cpu"}
              onChange={() => dispatch({ type: "SET_INFERENCE_MODE", mode: "cpu" })}
              aria-label="CPU"
              className="accent-[var(--color-accent)]"
            />
            <span>CPU Only</span>
          </label>
        </div>
      </fieldset>

      {/* VRAM input (GPU only) */}
      {inferenceMode === "gpu" && (
        <div className="space-y-1">
          <label htmlFor="vram-input" className="block text-sm font-medium">
            VRAM (MB)
          </label>
          <input
            id="vram-input"
            type="number"
            value={vramMb || ""}
            onChange={(e) => dispatch({ type: "SET_VRAM", vramMb: Number(e.target.value) || 0 })}
            placeholder="e.g. 8192"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
          />
          {state.detectedGpu && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Detected: {state.detectedGpu.name}
            </p>
          )}
        </div>
      )}

      {/* RAM input */}
      <div className="space-y-1">
        <label htmlFor="ram-input" className="block text-sm font-medium">
          RAM (GB)
        </label>
        <input
          id="ram-input"
          type="number"
          value={ramGb || ""}
          onChange={(e) => dispatch({ type: "SET_RAM", ramGb: Number(e.target.value) || 0 })}
          placeholder="e.g. 16"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
        />
      </div>

      {/* Model recommendation */}
      {recommendation && (
        <div
          data-testid="model-recommendation"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-2"
        >
          <h3 className="text-sm font-semibold">Recommended Configuration</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-[var(--color-text-secondary)]">Model: </span>
              <span>{recommendation.modelName}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)]">Quantization: </span>
              <span>{recommendation.quantization}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)]">GPU Layers: </span>
              <span>{recommendation.gpuLayers === "all" ? "All" : recommendation.gpuLayers}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)]">Tier: </span>
              <span className="capitalize">{recommendation.tier}</span>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {recommendation.description}
          </p>
        </div>
      )}
    </div>
  );
}
