import { useEffect, useState, useCallback } from "react";
import { useWizard } from "@/context/WizardContext";
import { parseRegistry } from "@/lib/service-registry";
import { generateInstallCommand } from "@/lib/install-command";
import { generateZipBundle } from "@/lib/zip-bundle";
import type { ServiceRegistry } from "@/types/service-registry";

export default function OutputStep() {
  const { state, dispatch } = useWizard();
  const [registry, setRegistry] = useState<ServiceRegistry | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/service-registry.json")
      .then((res) => res.json())
      .then((json) => setRegistry(parseRegistry(json)));
  }, []);

  const installCommand = registry ? generateInstallCommand(state) : "";

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [installCommand]);

  const handleDownload = useCallback(async () => {
    if (!registry) return;
    const blob = await generateZipBundle(state, registry);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jarvis.zip";
    a.click();
    URL.revokeObjectURL(url);
  }, [state, registry]);

  if (!registry) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Install Jarvis</h2>

      {/* Output mode tabs */}
      <div className="flex border-b border-[var(--color-border)]" role="tablist">
        <button
          role="tab"
          aria-selected={state.outputMode === "command"}
          onClick={() => dispatch({ type: "SET_OUTPUT_MODE", mode: "command" })}
          className={`px-4 py-2 text-sm font-medium ${
            state.outputMode === "command"
              ? "border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)]"
          }`}
        >
          Command
        </button>
        <button
          role="tab"
          aria-selected={state.outputMode === "bundle"}
          onClick={() => dispatch({ type: "SET_OUTPUT_MODE", mode: "bundle" })}
          className={`px-4 py-2 text-sm font-medium ${
            state.outputMode === "bundle"
              ? "border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)]"
          }`}
        >
          Bundle
        </button>
      </div>

      {/* Command mode */}
      {state.outputMode === "command" && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Run this command on your server to install Jarvis:
          </p>
          <div className="relative">
            <pre
              data-testid="install-command"
              className="overflow-x-auto rounded-lg bg-[var(--color-bg-secondary)] p-4 text-sm"
            >
              <code>{installCommand}</code>
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy"
              className="absolute right-2 top-2 rounded-md bg-[var(--color-bg-tertiary)] px-3 py-1 text-xs hover:bg-[var(--color-border)]"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Bundle mode */}
      {state.outputMode === "bundle" && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Download a zip bundle containing docker-compose.yml, .env, README.md, and
            service-registry.json configured for your setup.
          </p>
          <button
            type="button"
            onClick={handleDownload}
            aria-label="Download"
            className="rounded-lg bg-[var(--color-accent)] px-6 py-2 text-sm text-white hover:bg-[var(--color-accent-hover)]"
          >
            Download jarvis.zip
          </button>
        </div>
      )}
    </div>
  );
}
