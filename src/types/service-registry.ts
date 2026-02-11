export interface EnvVar {
  name: string;
  description: string;
  required: boolean;
  secret?: boolean;
  default?: string;
}

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  category: "core" | "optional";
  port: number;
  image: string;
  healthCheck: string;
  dependsOn: string[];
  envVars: EnvVar[];
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
