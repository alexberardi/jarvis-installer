import type { WizardState } from "@/types/wizard";
import type { ServiceRegistry, ServiceDefinition, InfrastructureDefinition } from "@/types/service-registry";
import { getCoreServices, getOptionalServices, getRequiredInfrastructure } from "@/lib/service-registry";

export function generateCompose(state: WizardState, registry: ServiceRegistry): string {
  const lines: string[] = [];
  const coreServices = getCoreServices(registry);
  const enabledOptional = getOptionalServices(registry).filter((s) =>
    state.enabledModules.includes(s.id),
  );
  const allEnabledServices = [...coreServices, ...enabledOptional];
  const enabledIds = allEnabledServices.map((s) => s.id);
  const infra = getRequiredInfrastructure(registry, enabledIds);

  // Also include grafana if loki is present
  const hasLoki = infra.some((i) => i.id === "loki");
  const grafana = registry.infrastructure.find((i) => i.id === "grafana");
  if (hasLoki && grafana && !infra.some((i) => i.id === "grafana")) {
    infra.push(grafana);
  }

  // Also include redis
  const redis = registry.infrastructure.find((i) => i.id === "redis");
  if (redis && !infra.some((i) => i.id === "redis")) {
    infra.push(redis);
  }

  lines.push('version: "3.8"');
  lines.push("");
  lines.push("services:");

  // Infrastructure services
  for (const inf of infra) {
    lines.push(...generateInfraService(inf));
    lines.push("");
  }

  // Application services
  for (const service of allEnabledServices) {
    lines.push(...generateAppService(service));
    lines.push("");
  }

  // Networks
  lines.push("networks:");
  lines.push("  jarvis:");
  lines.push("    driver: bridge");
  lines.push("");

  // Volumes
  lines.push("volumes:");
  const volumes = new Set<string>();
  for (const inf of infra) {
    for (const vol of inf.volumes) {
      const volName = vol.split(":")[0]!;
      volumes.add(volName);
    }
  }
  for (const vol of volumes) {
    lines.push(`  ${vol}:`);
  }

  return lines.join("\n");
}

function generateInfraService(infra: InfrastructureDefinition): string[] {
  const lines: string[] = [];
  lines.push(`  ${infra.id}:`);
  lines.push(`    image: ${infra.image}`);
  lines.push(`    container_name: jarvis-${infra.id}`);

  if (infra.port) {
    lines.push(`    ports:`);
    lines.push(`      - "${infra.port}:${infra.port}"`);
  }

  if (infra.envVars.length > 0) {
    lines.push(`    environment:`);
    for (const env of infra.envVars) {
      const value = env.default || (env.secret ? "CHANGE_ME" : "");
      lines.push(`      - ${env.name}=\${${env.name}:-${value}}`);
    }
  }

  if (infra.volumes.length > 0) {
    lines.push(`    volumes:`);
    for (const vol of infra.volumes) {
      lines.push(`      - ${vol}`);
    }
  }

  lines.push(`    networks:`);
  lines.push(`      - jarvis`);
  lines.push(`    restart: unless-stopped`);

  return lines;
}

function generateAppService(service: ServiceDefinition): string[] {
  const lines: string[] = [];
  lines.push(`  ${service.id}:`);
  lines.push(`    image: ${service.image}`);
  lines.push(`    container_name: ${service.id}`);

  lines.push(`    ports:`);
  lines.push(`      - "${service.port}:${service.port}"`);

  if (service.envVars.length > 0) {
    lines.push(`    environment:`);
    for (const env of service.envVars) {
      const value = env.default || (env.secret ? "CHANGE_ME" : "");
      lines.push(`      - ${env.name}=\${${env.name}:-${value}}`);
    }
  }

  if (service.dependsOn.length > 0) {
    lines.push(`    depends_on:`);
    for (const dep of service.dependsOn) {
      lines.push(`      ${dep}:`);
      lines.push(`        condition: service_started`);
    }
  }

  lines.push(`    healthcheck:`);
  lines.push(`      test: ["CMD", "curl", "-f", "http://localhost:${service.port}${service.healthCheck}"]`);
  lines.push(`      interval: 30s`);
  lines.push(`      timeout: 10s`);
  lines.push(`      retries: 3`);

  lines.push(`    networks:`);
  lines.push(`      - jarvis`);
  lines.push(`    restart: unless-stopped`);

  return lines;
}
