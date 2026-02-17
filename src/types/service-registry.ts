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
