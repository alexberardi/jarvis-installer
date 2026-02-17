import type { WizardState } from "@/types/wizard";
import type { ServiceRegistry } from "@/types/service-registry";
import { getCoreServices, getOptionalServices } from "@/lib/service-registry";

export function generateReadme(state: WizardState, registry: ServiceRegistry): string {
  const lines: string[] = [];
  const coreServices = getCoreServices(registry);
  const enabledOptional = getOptionalServices(registry).filter((s) =>
    state.enabledModules.includes(s.id),
  );
  const allEnabled = [...coreServices, ...enabledOptional];

  lines.push("# Jarvis");
  lines.push("");
  lines.push("Your personal voice assistant stack.");
  lines.push("");

  // Quick start
  lines.push("## Quick Start");
  lines.push("");
  lines.push("```bash");
  lines.push("cd jarvis");
  lines.push("docker compose up -d");
  lines.push("```");
  lines.push("");
  lines.push("Wait ~30 seconds for all services to start.");
  lines.push("");

  // Services
  lines.push("## Services");
  lines.push("");
  lines.push("### Core");
  lines.push("");
  for (const s of coreServices) {
    const port = state.portOverrides[s.id] ?? s.port;
    lines.push(`- **${s.name}** (port ${port}) - ${s.description}`);
  }
  lines.push("");

  if (enabledOptional.length > 0) {
    lines.push("### Optional");
    lines.push("");
    for (const s of enabledOptional) {
      const port = state.portOverrides[s.id] ?? s.port;
      lines.push(`- **${s.name}** (port ${port}) - ${s.description}`);
    }
    lines.push("");
  }

  // Configuration
  lines.push("## Configuration");
  lines.push("");
  lines.push("Edit `.env` to change ports or secrets. Host ports can be changed");
  lines.push("without affecting internal service communication.");
  lines.push("");

  // Database
  lines.push("## Database");
  lines.push("");
  lines.push("PostgreSQL is shared across services. The `init-db.sh` script");
  lines.push("creates all databases on first run:");
  lines.push("");
  for (const s of allEnabled) {
    if (s.database) {
      lines.push(`- \`${s.database}\` (${s.name})`);
    }
  }
  lines.push("");

  // Health checks
  lines.push("## Health Checks");
  lines.push("");
  lines.push("```bash");
  for (const s of allEnabled) {
    const port = state.portOverrides[s.id] ?? s.port;
    lines.push(`curl http://localhost:${port}${s.healthCheck}  # ${s.name}`);
  }
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}
