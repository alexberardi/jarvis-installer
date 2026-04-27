export interface EnvVar {
  name: string;
  description: string;
  required: boolean;
  secret?: boolean;
  default?: string;
  /** References a key in WizardState.secrets for ${VAR} substitution */
  secretRef?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  size: string;
  default?: boolean;
  /** true = baked into the pre-built Docker image */
  builtin?: boolean;
}

export interface LlmInterfaceOption {
  id: string;
  name: string;
  description: string;
  default?: boolean;
}

export interface WorkerDefinition {
  /** Compose service id (also used as container_name). */
  id: string;
  /** Command to launch the worker (e.g. "python scripts/queue_worker.py"). */
  command: string;
  /** Env vars to add or override on top of the parent service's environment. */
  envOverrides?: Record<string, string>;
}

export interface ModelPreset {
  id: string;
  name: string;
  description: string;
  hfRepo: string;
  modelName: string;
  backend: "GGUF" | "VLLM";
  chatFormat: string;
  contextWindow: number;
  interface: string;
  vram: string;
  hfFilename?: string;
}

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  category: "core" | "recommended" | "optional";
  port: number;
  image: string;
  healthCheck: string;
  dependsOn: string[];
  envVars: EnvVar[];
  /** Database name this service needs (created by init-db.sh) */
  database?: string;
  /** DATABASE_URL driver prefix (default: "postgresql://") */
  dbDriverPrefix?: string;
  /** Selectable model options (e.g., whisper model sizes) */
  modelOptions?: ModelOption[];
  /** LLM interface/prompt provider options */
  llmInterfaceOptions?: LlmInterfaceOption[];
  /** Pre-configured model presets with download info */
  modelPresets?: ModelPreset[];
  /** Internal container port (if different from host-facing port) */
  containerPort?: number;
  /** Whether this service requires GPU access */
  gpu?: boolean;
  /**
   * For `gpu: true` services that ship a CPU image alongside GPU variants
   * (e.g. whisper publishes :latest, :latest-cuda, :latest-rocm). When set,
   * the variant suffix is only applied for GPU types we actually publish
   * (nvidia/amd-rocm); other GPUs / CPU hosts use the plain image with no
   * GPU runtime config.
   */
  cpuFallback?: boolean;
  /** true = mount ${MODELS_DIR:-./.models}:/app/.models (LLM-style services). */
  modelVolume?: boolean;
  /** Sibling worker containers that share this service's image and most config. */
  workers?: WorkerDefinition[];
}

export interface InfrastructureDefinition {
  id: string;
  name: string;
  description: string;
  image: string;
  port: number;
  envVars: EnvVar[];
  volumes: string[];
}

export interface ServiceRegistry {
  version: string;
  services: ServiceDefinition[];
  infrastructure: InfrastructureDefinition[];
}
