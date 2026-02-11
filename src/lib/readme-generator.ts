import type { WizardState } from "@/types/wizard";
import type { ServiceRegistry } from "@/types/service-registry";
import { getCoreServices, getOptionalServices } from "@/lib/service-registry";

export function generateReadme(state: WizardState, registry: ServiceRegistry): string {
  const lines: string[] = [];

  lines.push("# Jarvis");
  lines.push("");
  lines.push("Your personal voice assistant stack.");
  lines.push("");

  // Hardware summary
  lines.push("## Hardware Configuration");
  lines.push("");
  lines.push(`- **Inference Mode**: ${state.inferenceMode.toUpperCase()}`);
  if (state.inferenceMode === "gpu" && state.vramMb) {
    lines.push(`- **VRAM**: ${state.vramMb} MB`);
  }
  lines.push(`- **RAM**: ${state.ramGb} GB`);
  if (state.recommendation) {
    lines.push(`- **Model**: ${state.recommendation.modelName}`);
    lines.push(`- **Quantization**: ${state.recommendation.quantization}`);
    lines.push(`- **GPU Layers**: ${state.recommendation.gpuLayers}`);
  }
  lines.push("");

  // Services
  lines.push("## Services");
  lines.push("");
  const coreServices = getCoreServices(registry);
  const enabledOptional = getOptionalServices(registry).filter((s) =>
    state.enabledModules.includes(s.id),
  );

  lines.push("### Core");
  lines.push("");
  for (const s of coreServices) {
    lines.push(`- **${s.name}** (port ${s.port}) — ${s.description}`);
  }
  lines.push("");

  if (enabledOptional.length > 0) {
    lines.push("### Optional Modules");
    lines.push("");
    for (const s of enabledOptional) {
      lines.push(`- **${s.name}** (port ${s.port}) — ${s.description}`);
    }
    lines.push("");
  }

  // Quickstart
  lines.push("## Quickstart");
  lines.push("");
  lines.push("```bash");
  lines.push("cd ~/jarvis");
  lines.push("docker compose up -d");
  lines.push("```");
  lines.push("");

  lines.push("## Health Check");
  lines.push("");
  lines.push("```bash");
  lines.push("# Check all services");
  for (const s of [...coreServices, ...enabledOptional]) {
    lines.push(`curl http://localhost:${s.port}${s.healthCheck}`);
  }
  lines.push("```");

  return lines.join("\n");
}
