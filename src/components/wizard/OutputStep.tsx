import { useEffect, useState, useCallback, useMemo } from "react";
import { useWizard } from "@/context/WizardContext";
import { parseRegistry } from "@/lib/service-registry";
import { generateCompose } from "@/lib/compose-generator";
import { generateEnv } from "@/lib/env-generator";
import { generateZipBundle } from "@/lib/zip-bundle";
import type { ServiceRegistry } from "@/types/service-registry";

type PreviewTab = "compose" | "env";

export default function OutputStep() {
  const { state } = useWizard();
  const [registry, setRegistry] = useState<ServiceRegistry | null>(null);
  const [activeTab, setActiveTab] = useState<PreviewTab>("compose");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}service-registry.json`)
      .then((res) => res.json())
      .then((json) => setRegistry(parseRegistry(json)));
  }, []);

  const composeContent = useMemo(
    () => (registry ? generateCompose(state, registry) : ""),
    [state, registry],
  );

  const envContent = useMemo(
    () => (registry ? generateEnv(state, registry) : ""),
    [state, registry],
  );

  const activeContent = activeTab === "compose" ? composeContent : envContent;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeContent]);

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

  const showWhisperWarning = state.whisperModel !== "base.en" && state.enabledModules.includes("jarvis-whisper-api");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Install Jarvis</h2>

      {/* Whisper model warning */}
      {showWhisperWarning && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800"
          data-testid="whisper-download-warning"
        >
          <p className="mb-2 font-medium">
            Whisper model &quot;{state.whisperModel}&quot; requires manual download
          </p>
          <ol className="list-inside list-decimal space-y-1 text-xs">
            <li>Create a <code className="rounded bg-amber-100 px-1">models/</code> directory next to your docker-compose.yml</li>
            <li>
              Download the model:
              <pre className="mt-1 overflow-x-auto rounded bg-amber-100 p-2">
                {`docker run --rm -v ./models:/out ghcr.io/alexberardi/jarvis-whisper-api:latest \\
  bash -c "cd /root/whisper.cpp && bash models/download-ggml-model.sh ${state.whisperModel} && cp models/ggml-${state.whisperModel}.bin /out/"`}
              </pre>
            </li>
            <li>The generated docker-compose.yml already includes the volume mount and env var.</li>
          </ol>
        </div>
      )}

      {/* File preview tabs */}
      <div className="flex border-b border-[var(--color-border)]" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "compose"}
          onClick={() => { setActiveTab("compose"); setCopied(false); }}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "compose"
              ? "border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)]"
          }`}
        >
          docker-compose.yml
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "env"}
          onClick={() => { setActiveTab("env"); setCopied(false); }}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "env"
              ? "border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)]"
          }`}
        >
          .env
        </button>
      </div>

      {/* Preview */}
      <div className="relative">
        <pre
          data-testid={`preview-${activeTab}`}
          className="max-h-96 overflow-auto rounded-lg bg-[var(--color-bg-secondary)] p-4 text-xs"
        >
          <code>{activeContent}</code>
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

      {/* Download */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleDownload}
          aria-label="Download"
          className="rounded-lg bg-[var(--color-accent)] px-6 py-2 text-sm text-white hover:bg-[var(--color-accent-hover)]"
          data-testid="download-zip"
        >
          Download jarvis.zip
        </button>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Contains docker-compose.yml, .env, init-db.sh, and README.md
        </p>
      </div>

      {/* Quick start */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <h3 className="mb-2 text-sm font-medium">Quick Start</h3>
        <ol className="list-inside list-decimal space-y-1 text-xs text-[var(--color-text-secondary)]">
          <li>Download and extract the zip</li>
          <li><code>cd jarvis</code></li>
          <li><code>docker compose up -d</code></li>
          <li>Wait for services to start (~30 seconds)</li>
        </ol>
      </div>
    </div>
  );
}
