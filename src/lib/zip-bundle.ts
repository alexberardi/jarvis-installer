import JSZip from "jszip";
import type { WizardState } from "@/types/wizard";
import type { ServiceRegistry } from "@/types/service-registry";
import { generateCompose, getAllEnabledServices } from "./compose-generator";
import { generateEnv } from "./env-generator";
import { generateReadme } from "./readme-generator";
import { generateInitDbScript } from "./init-db-generator";

export async function generateZipBundle(
  state: WizardState,
  registry: ServiceRegistry,
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder("jarvis")!;

  const enabledServices = getAllEnabledServices(state, registry);
  const primaryDb = registry.infrastructure
    .find((i) => i.id === "postgres")
    ?.envVars.find((e) => e.name === "POSTGRES_DB")?.default ?? "jarvis_config";

  folder.file("docker-compose.yml", generateCompose(state, registry));
  folder.file(".env", generateEnv(state, registry));
  folder.file("init-db.sh", generateInitDbScript(enabledServices, primaryDb));
  folder.file("README.md", generateReadme(state, registry));

  return zip.generateAsync({ type: "blob" });
}
