import JSZip from "jszip";
import type { WizardState } from "@/types/wizard";
import type { ServiceRegistry } from "@/types/service-registry";
import { generateCompose } from "./compose-generator";
import { generateEnv } from "./env-generator";
import { generateReadme } from "./readme-generator";

export async function generateZipBundle(
  state: WizardState,
  registry: ServiceRegistry,
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder("jarvis")!;

  folder.file("docker-compose.yml", generateCompose(state, registry));
  folder.file(".env", generateEnv(state, registry));
  folder.file("README.md", generateReadme(state, registry));
  folder.file("service-registry.json", JSON.stringify(registry, null, 2));

  return zip.generateAsync({ type: "blob" });
}
