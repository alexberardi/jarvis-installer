import type { WizardState } from "@/types/wizard";
import type { ServiceRegistry, ServiceDefinition, InfrastructureDefinition, WorkerDefinition } from "@/types/service-registry";
import { getCoreServices, getRecommendedServices, getOptionalServices, getRequiredInfrastructure } from "@/lib/service-registry";
import { serviceIdToPortVar } from "@/lib/port-utils";

const FIRST_PARTY_PREFIX = "ghcr.io/alexberardi/";

// GPU types we publish image variants for on `cpuFallback` services.
// Other GPU types (amd Vulkan, none) fall back to the plain CPU image
// since whisper only ships -cuda / -rocm builds.
const CPU_FALLBACK_GPU_VARIANTS = new Set<string>(["nvidia", "amd-rocm"]);

function shouldUseGpuVariant(service: ServiceDefinition, gpuType: string): boolean {
  if (!service.gpu) return false;
  if (service.cpuFallback && !CPU_FALLBACK_GPU_VARIANTS.has(gpuType)) return false;
  return true;
}

/**
 * Resolve the image reference for a first-party Jarvis service.
 * Replaces the hardcoded tag with ${JARVIS_IMAGE_TAG:-latest} so users
 * can switch between stable (:latest) and dev (:dev) tracks via .env,
 * and appends a GPU variant suffix (-cuda/-vulkan/-rocm/-cpu) for
 * services that ship variant builds (llm-proxy, whisper).
 * Third-party images (e.g. go2rtc) are returned unchanged.
 */
function getServiceImage(service: ServiceDefinition, state: WizardState): string {
  const image = service.image;
  if (!image.startsWith(FIRST_PARTY_PREFIX)) return image;
  const baseImage = image.includes(":") ? image.slice(0, image.lastIndexOf(":")) : image;

  let gpuSuffix = "";
  if (shouldUseGpuVariant(service, state.gpuType)) {
    const variantSuffix: Record<string, string> = {
      nvidia: "-cuda",
      amd: "-vulkan",
      "amd-rocm": "-rocm",
      none: "-cpu",
    };
    gpuSuffix = variantSuffix[state.gpuType] ?? "";
  }

  return `${baseImage}:\${JARVIS_IMAGE_TAG:-latest}${gpuSuffix}`;
}

function pushGpuConfig(
  lines: string[],
  service: ServiceDefinition,
  state: WizardState,
): void {
  if (!shouldUseGpuVariant(service, state.gpuType) || !state.gpuEnabled) return;
  if (state.gpuType === "nvidia") {
    lines.push("    ipc: host");
    lines.push('    shm_size: "8gb"');
    lines.push("    deploy:");
    lines.push("      resources:");
    lines.push("        reservations:");
    lines.push("          devices:");
    lines.push("            - driver: nvidia");
    lines.push("              count: all");
    lines.push("              capabilities: [gpu]");
  } else if (state.gpuType === "amd" || state.gpuType === "amd-rocm") {
    lines.push("    devices:");
    lines.push("      - /dev/dri:/dev/dri");
    lines.push("      - /dev/kfd:/dev/kfd");
    lines.push("    ipc: host");
    lines.push('    shm_size: "8gb"');
    lines.push("    group_add:");
    lines.push("      - video");
    lines.push("      - render");
  }
}

/**
 * Returns all enabled services (core + selected recommended + selected optional).
 */
export function getAllEnabledServices(
  state: WizardState,
  registry: ServiceRegistry,
): ServiceDefinition[] {
  const core = getCoreServices(registry);
  const enabledRecommended = getRecommendedServices(registry).filter((s) =>
    state.enabledModules.includes(s.id),
  );
  const enabledOptional = getOptionalServices(registry).filter((s) =>
    state.enabledModules.includes(s.id),
  );
  return [...core, ...enabledRecommended, ...enabledOptional];
}

/**
 * Returns all required infrastructure for the enabled services,
 * plus grafana (if loki is present) and redis (always).
 */
export function getInfraForServices(
  enabledIds: string[],
  registry: ServiceRegistry,
): InfrastructureDefinition[] {
  const infra = getRequiredInfrastructure(registry, enabledIds);

  const hasLoki = infra.some((i) => i.id === "loki");
  const grafana = registry.infrastructure.find((i) => i.id === "grafana");
  if (hasLoki && grafana && !infra.some((i) => i.id === "grafana")) {
    infra.push(grafana);
  }

  const redis = registry.infrastructure.find((i) => i.id === "redis");
  if (redis && !infra.some((i) => i.id === "redis")) {
    infra.push(redis);
  }

  return infra;
}

export function generateCompose(state: WizardState, registry: ServiceRegistry): string {
  const allEnabled = getAllEnabledServices(state, registry);
  const enabledIds = allEnabled.map((s) => s.id);
  const infra = getInfraForServices(enabledIds, registry);

  const lines: string[] = [];

  lines.push("services:");

  // Infrastructure first
  for (const inf of infra) {
    lines.push("");
    lines.push(...generateInfraBlock(inf, state));
  }

  // Application services (and any sibling workers)
  for (const service of allEnabled) {
    lines.push("");
    lines.push(...generateServiceBlock(service, state, registry));
    if (service.workers) {
      for (const worker of service.workers) {
        lines.push("");
        lines.push(...generateWorkerBlock(worker, service, state, registry));
      }
    }
  }

  // Networks
  lines.push("");
  lines.push("networks:");
  lines.push("  jarvis:");
  lines.push("    driver: bridge");

  // Volumes
  lines.push("");
  lines.push("volumes:");
  const volumes = new Set<string>();
  for (const inf of infra) {
    for (const vol of inf.volumes) {
      volumes.add(vol.split(":")[0]!);
    }
  }
  // Whisper voice profiles survive container recreates
  if (allEnabled.some((s) => s.id === "jarvis-whisper-api")) {
    volumes.add("whisper-voice-profiles");
  }
  // Command-center custom prompt providers survive container recreates
  if (allEnabled.some((s) => s.id === "jarvis-command-center")) {
    volumes.add("command-center-prompt-providers");
  }
  for (const vol of volumes) {
    lines.push(`  ${vol}:`);
  }

  lines.push("");
  return lines.join("\n");
}

function generateInfraBlock(
  infra: InfrastructureDefinition,
  state: WizardState,
): string[] {
  const lines: string[] = [];
  const portVar = serviceIdToPortVar(infra.id);
  const hostPort = state.infraPortOverrides[infra.id] ?? infra.port;

  lines.push(`  ${infra.id}:`);
  lines.push(`    image: ${infra.image}`);
  lines.push(`    container_name: jarvis-${infra.id}`);

  if (infra.port) {
    lines.push("    ports:");
    lines.push(`      - "\${${portVar}:-${hostPort}}:${infra.port}"`);
  }

  // Environment
  if (infra.envVars.length > 0) {
    lines.push("    environment:");
    for (const env of infra.envVars) {
      if (env.secretRef) {
        lines.push(`      ${env.name}: \${${env.secretRef}}`);
      } else {
        const value = env.default ?? "";
        lines.push(`      ${env.name}: \${${env.name}:-${value}}`);
      }
    }
  }

  // Redis needs a command for password auth
  if (infra.id === "redis") {
    lines.push("    command: redis-server --requirepass \${REDIS_PASSWORD}");
  }

  // Postgres needs healthcheck and init-db mount
  if (infra.id === "postgres") {
    lines.push("    healthcheck:");
    lines.push("      test: [\"CMD-SHELL\", \"pg_isready -U \${DB_USER:-jarvis}\"]");
    lines.push("      interval: 10s");
    lines.push("      timeout: 5s");
    lines.push("      retries: 5");
    lines.push("    volumes:");
    for (const vol of infra.volumes) {
      lines.push(`      - ${vol}`);
    }
    lines.push("      - ./init-db.sh:/docker-entrypoint-initdb.d/init-db.sh");
  } else if (infra.volumes.length > 0) {
    lines.push("    volumes:");
    for (const vol of infra.volumes) {
      lines.push(`      - ${vol}`);
    }
  }

  lines.push("    networks:");
  lines.push("      - jarvis");
  lines.push("    restart: unless-stopped");

  return lines;
}

function generateServiceBlock(
  service: ServiceDefinition,
  state: WizardState,
  registry: ServiceRegistry,
): string[] {
  const lines: string[] = [];
  const portVar = serviceIdToPortVar(service.id);
  const hostPort = state.portOverrides[service.id] ?? service.port;

  lines.push(`  ${service.id}:`);
  lines.push(`    image: ${getServiceImage(service, state)}`);
  lines.push(`    container_name: ${service.id}`);

  // Ports
  lines.push("    ports:");
  lines.push(`      - "\${${portVar}:-${hostPort}}:${service.port}"`);

  // Environment
  lines.push("    environment:");
  if (service.database) {
    const driver = service.dbDriverPrefix ?? "postgresql://";
    lines.push(
      `      DATABASE_URL: ${driver}\${DB_USER:-jarvis}:\${POSTGRES_PASSWORD}@postgres:5432/${service.database}`,
    );
    lines.push(
      `      MIGRATIONS_DATABASE_URL: ${driver}\${DB_USER:-jarvis}:\${POSTGRES_PASSWORD}@postgres:5432/${service.database}`,
    );
  }
  for (const env of service.envVars) {
    // Skip DATABASE_URL since we generate it from the database field
    if (env.name === "DATABASE_URL" || env.name === "MIGRATIONS_DATABASE_URL") continue;
    if (env.secretRef) {
      lines.push(`      ${env.name}: \${${env.secretRef}}`);
    } else if (env.default) {
      lines.push(`      ${env.name}: ${env.default}`);
    }
  }

  // Whisper model override for non-default models
  const isWhisper = service.id === "jarvis-whisper-api";
  const nonDefaultWhisper = isWhisper && state.whisperModel !== "base.en";
  if (nonDefaultWhisper) {
    lines.push(`      WHISPER_MODEL: /whisper-models/ggml-${state.whisperModel}.bin`);
  }

  // LLM interface seed for command-center
  if (service.id === "jarvis-command-center" && state.llmInterface) {
    lines.push(`      LLM_INTERFACE_SEED: ${state.llmInterface}`);
  }

  // Dependencies
  if (service.dependsOn.length > 0) {
    lines.push("    depends_on:");
    for (const dep of service.dependsOn) {
      const isInfra = registry.infrastructure.some((i) => i.id === dep);
      if (isInfra && dep === "postgres") {
        lines.push(`      ${dep}:`);
        lines.push("        condition: service_healthy");
      } else {
        lines.push(`      ${dep}:`);
        lines.push("        condition: service_started");
      }
    }
  }

  // Volumes (whisper)
  if (isWhisper) {
    lines.push("    volumes:");
    lines.push("      - ./whisper-models:/whisper-models:ro");
    lines.push("      - whisper-voice-profiles:/app/voice_profiles");
  }

  // Command-center custom prompt providers (Pantry installs)
  if (service.id === "jarvis-command-center") {
    lines.push("    volumes:");
    lines.push("      - command-center-prompt-providers:/app/core/prompt_providers_custom");
  }

  // GPU runtime config (device passthrough, ipc, shm_size) for variant services
  pushGpuConfig(lines, service, state);

  // Healthcheck
  lines.push("    healthcheck:");
  lines.push(`      test: ["CMD", "curl", "-f", "http://localhost:${service.port}${service.healthCheck}"]`);
  lines.push("      interval: 30s");
  lines.push("      timeout: 10s");
  lines.push("      retries: 3");

  lines.push("    networks:");
  lines.push("      - jarvis");
  lines.push("    restart: unless-stopped");

  return lines;
}

function generateWorkerBlock(
  worker: WorkerDefinition,
  parent: ServiceDefinition,
  state: WizardState,
  registry: ServiceRegistry,
): string[] {
  const lines: string[] = [];
  const overrides = worker.envOverrides ?? {};
  const overrideKeys = new Set(Object.keys(overrides));

  lines.push(`  ${worker.id}:`);
  lines.push(`    image: ${getServiceImage(parent, state)}`);
  lines.push(`    container_name: ${worker.id}`);

  lines.push("    environment:");
  if (parent.database) {
    const driver = parent.dbDriverPrefix ?? "postgresql://";
    if (!overrideKeys.has("DATABASE_URL")) {
      lines.push(
        `      DATABASE_URL: ${driver}\${DB_USER:-jarvis}:\${POSTGRES_PASSWORD}@postgres:5432/${parent.database}`,
      );
    }
    if (!overrideKeys.has("MIGRATIONS_DATABASE_URL")) {
      lines.push(
        `      MIGRATIONS_DATABASE_URL: ${driver}\${DB_USER:-jarvis}:\${POSTGRES_PASSWORD}@postgres:5432/${parent.database}`,
      );
    }
  }
  for (const env of parent.envVars) {
    if (env.name === "DATABASE_URL" || env.name === "MIGRATIONS_DATABASE_URL") continue;
    if (overrideKeys.has(env.name)) continue;
    if (env.secretRef) {
      lines.push(`      ${env.name}: \${${env.secretRef}}`);
    } else if (env.default) {
      lines.push(`      ${env.name}: ${env.default}`);
    }
  }
  for (const [key, val] of Object.entries(overrides)) {
    lines.push(`      ${key}: ${val}`);
  }

  lines.push(`    command: ${worker.command}`);

  lines.push("    depends_on:");
  lines.push(`      ${parent.id}:`);
  lines.push("        condition: service_healthy");
  for (const dep of parent.dependsOn) {
    const isInfra = registry.infrastructure.some((i) => i.id === dep);
    if (!isInfra) continue;
    lines.push(`      ${dep}:`);
    lines.push(`        condition: ${dep === "postgres" ? "service_healthy" : "service_started"}`);
  }

  // Worker inherits parent's GPU runtime config (needed for llm-proxy-worker)
  pushGpuConfig(lines, parent, state);

  lines.push("    networks:");
  lines.push("      - jarvis");
  lines.push("    restart: unless-stopped");

  return lines;
}
