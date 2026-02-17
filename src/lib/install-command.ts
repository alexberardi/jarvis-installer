import type { WizardState } from "@/types/wizard";

const INSTALL_SCRIPT_URL =
  "https://raw.githubusercontent.com/alexanderberardi/jarvis-installer/main/install.sh";

export function generateInstallCommand(state: WizardState): string {
  const flags: string[] = [];

  // Profile
  flags.push(`--profile ${state.inferenceMode}`);

  // Model configuration
  if (state.recommendation) {
    flags.push(`--model ${state.recommendation.modelId}`);
    flags.push(`--quantization ${state.recommendation.quantization}`);
    flags.push(`--gpu-layers ${state.recommendation.gpuLayers}`);
  }

  // Wake word
  if (state.wakeWord && state.wakeWord !== "jarvis") {
    flags.push(`--wake-word "${state.wakeWord}"`);
  }

  // Modules
  if (state.enabledModules.length > 0) {
    flags.push(`--modules ${state.enabledModules.join(",")}`);
  }

  const flagStr = flags.join(" \\\n  ");
  return `curl -fsSL ${INSTALL_SCRIPT_URL} | bash -s -- \\\n  ${flagStr}`;
}
