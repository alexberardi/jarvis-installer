import { useEffect, useState, useCallback } from "react";
import { useWizard } from "@/context/WizardContext";
import { parseRegistry, getCoreServices, getRecommendedServices, getOptionalServices, getRequiredInfrastructure } from "@/lib/service-registry";
import { generateAllSecrets } from "@/lib/secret-generator";
import { detectPortConflicts, buildPortEntries, serviceIdToPortVar } from "@/lib/port-utils";
import type { ServiceRegistry, ModelOption, LlmInterfaceOption } from "@/types/service-registry";
import type { TtsBackend, WhisperBackend } from "@/types/wizard";

export default function ConfigurationStep() {
  const { state, dispatch } = useWizard();
  const [registry, setRegistry] = useState<ServiceRegistry | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}service-registry.json`)
      .then((res) => res.json())
      .then((json) => setRegistry(parseRegistry(json)));
  }, []);

  // Auto-generate secrets on first visit
  useEffect(() => {
    if (Object.keys(state.secrets).length === 0) {
      dispatch({ type: "REGENERATE_SECRETS", secrets: generateAllSecrets() });
    }
  }, [state.secrets, dispatch]);

  const handleRegenerateAll = useCallback(() => {
    dispatch({ type: "REGENERATE_SECRETS", secrets: generateAllSecrets() });
  }, [dispatch]);

  if (!registry) {
    return <div>Loading configuration...</div>;
  }

  const coreServices = getCoreServices(registry);
  const enabledRecommended = getRecommendedServices(registry).filter((s) =>
    state.enabledModules.includes(s.id),
  );
  const enabledOptional = getOptionalServices(registry).filter((s) =>
    state.enabledModules.includes(s.id),
  );
  const allEnabled = [...coreServices, ...enabledRecommended, ...enabledOptional];
  const enabledIds = allEnabled.map((s) => s.id);

  // Get required infrastructure
  const infra = getRequiredInfrastructure(registry, enabledIds);
  const redis = registry.infrastructure.find((i) => i.id === "redis");
  if (redis && !infra.some((i) => i.id === "redis")) infra.push(redis);
  const hasLoki = infra.some((i) => i.id === "loki");
  const grafana = registry.infrastructure.find((i) => i.id === "grafana");
  if (hasLoki && grafana && !infra.some((i) => i.id === "grafana")) infra.push(grafana);

  // Port conflict detection
  const portEntries = buildPortEntries(allEnabled, infra, state.portOverrides, state.infraPortOverrides);
  const conflicts = detectPortConflicts(portEntries);
  const conflictPorts = new Set(conflicts.keys());

  // Whisper model options
  const whisperService = allEnabled.find((s) => s.id === "jarvis-whisper-api");
  const ttsService = allEnabled.find((s) => s.id === "jarvis-tts");
  const modelOptions: ModelOption[] = whisperService?.modelOptions ?? [];

  // LLM interface options
  const commandCenter = allEnabled.find((s) => s.id === "jarvis-command-center");
  const llmInterfaceOptions: LlmInterfaceOption[] = commandCenter?.llmInterfaceOptions ?? [];

  // Databases that will be created
  const databases = allEnabled.filter((s) => s.database).map((s) => s.database!);

  return (
    <div className="space-y-8 pb-8">
      <h2 className="text-xl font-semibold">Configure</h2>

      {/* Port conflicts warning */}
      {conflictPorts.size > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800" data-testid="port-conflicts">
          <strong>Port conflicts detected:</strong>
          {Array.from(conflicts.entries()).map(([port, names]) => (
            <div key={port}>Port {port} is used by: {names.join(", ")}</div>
          ))}
        </div>
      )}

      {/* Host Ports */}
      <section>
        <h3 className="mb-3 text-sm font-medium">Host Ports</h3>
        <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
          These are the ports exposed on your host machine. Internal service communication is unaffected.
        </p>
        <div className="space-y-2">
          {allEnabled.map((svc) => {
            const port = state.portOverrides[svc.id] ?? svc.port;
            const hasConflict = conflictPorts.has(port);
            return (
              <PortRow
                key={svc.id}
                label={svc.name}
                portVar={serviceIdToPortVar(svc.id)}
                defaultPort={svc.port}
                currentPort={port}
                hasConflict={hasConflict}
                onChange={(p) => dispatch({ type: "SET_PORT_OVERRIDE", serviceId: svc.id, port: p })}
              />
            );
          })}
          <div className="mt-3 border-t border-[var(--color-border)] pt-3">
            <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Infrastructure</p>
            {infra.map((inf) => {
              const port = state.infraPortOverrides[inf.id] ?? inf.port;
              const hasConflict = conflictPorts.has(port);
              return (
                <InfraPortRow
                  key={inf.id}
                  name={inf.name}
                  description={inf.description}
                  portVar={serviceIdToPortVar(inf.id)}
                  defaultPort={inf.port}
                  currentPort={port}
                  hasConflict={hasConflict}
                  onChange={(p) => dispatch({ type: "SET_INFRA_PORT_OVERRIDE", infraId: inf.id, port: p })}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Whisper Model (conditional) */}
      {whisperService && modelOptions.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium">Whisper Model</h3>
          <select
            value={state.whisperModel}
            onChange={(e) => dispatch({ type: "SET_WHISPER_MODEL", model: e.target.value })}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
            data-testid="whisper-model-select"
          >
            {modelOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name} ({opt.size}){opt.builtin ? " - included in image" : ""}
              </option>
            ))}
          </select>
          {state.whisperModel !== "base.en" && (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800" data-testid="whisper-model-warning">
              This model is not included in the pre-built image. You will need to download it before starting.
              Instructions will be shown on the next step.
            </div>
          )}
        </section>
      )}

      {/* Whisper GPU backend (conditional) */}
      {whisperService && (
        <section>
          <h3 className="mb-3 text-sm font-medium">Whisper GPU Backend</h3>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            Where speech-to-text runs. CPU is fast for the default base.en model and
            leaves the GPU free for the LLM; pick a GPU backend only if you want Whisper
            on the GPU.
          </p>
          <select
            value={state.whisperBackend}
            onChange={(e) => dispatch({ type: "SET_WHISPER_BACKEND", backend: e.target.value as WhisperBackend })}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
            data-testid="whisper-backend-select"
          >
            <option value="cpu">CPU (default)</option>
            <option value="cuda">NVIDIA (CUDA)</option>
            <option value="vulkan">AMD / generic (Vulkan)</option>
            <option value="rocm">AMD (ROCm)</option>
          </select>
        </section>
      )}

      {/* TTS inference device (conditional) */}
      {ttsService && (
        <section>
          <h3 className="mb-3 text-sm font-medium">Text-to-Speech Device</h3>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            Where Kokoro speech synthesis runs. CPU is fine for most installs;
            CUDA gives the fastest first-audio. On multi-GPU hosts, set
            TTS_GPU_DEVICE in .env to pick which GPU (default 0).
          </p>
          <select
            value={state.ttsBackend}
            onChange={(e) => dispatch({ type: "SET_TTS_BACKEND", backend: e.target.value as TtsBackend })}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
            data-testid="tts-backend-select"
          >
            <option value="cpu">CPU (default)</option>
            <option value="cuda">NVIDIA (CUDA)</option>
          </select>
        </section>
      )}

      {/* Image pinning (advanced) */}
      <section>
        <h3 className="mb-3 text-sm font-medium">Image Updates</h3>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={state.pinImages}
            onChange={(e) => dispatch({ type: "SET_PIN_IMAGES", enabled: e.target.checked })}
            className="mt-0.5"
            data-testid="pin-images-checkbox"
          />
          <span>
            <span className="font-medium">Pin images by digest (advanced)</span>
            <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
              Supply-chain hardening: locks every service to an exact build. Leave OFF
              for normal use — when pinned, docker compose pull will never update
              anything; updates only happen through the admin&apos;s reconcile.
            </span>
          </span>
        </label>
      </section>

      {/* LLM Interface */}
      {commandCenter && llmInterfaceOptions.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium">LLM Interface</h3>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            Prompt provider for voice command processing. Match this to your LLM model.
          </p>
          <select
            value={state.llmInterface}
            onChange={(e) => dispatch({ type: "SET_LLM_INTERFACE", interfaceId: e.target.value })}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
            data-testid="llm-interface-select"
          >
            {llmInterfaceOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}{opt.default ? " (default)" : ""}
              </option>
            ))}
          </select>
          {llmInterfaceOptions.find((o) => o.id === state.llmInterface)?.description && (
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              {llmInterfaceOptions.find((o) => o.id === state.llmInterface)?.description}
            </p>
          )}
        </section>
      )}

      {/* Release Track */}
      <section>
        <h3 className="mb-3 text-sm font-medium">Release Track</h3>
        <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
          Choose which image tags to pull. Stable uses tagged releases; Dev uses the latest main branch builds.
        </p>
        <select
          value={state.releaseTrack}
          onChange={(e) => dispatch({ type: "SET_RELEASE_TRACK", track: e.target.value as "stable" | "dev" })}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
          data-testid="release-track-select"
        >
          <option value="stable">Stable (tagged releases)</option>
          <option value="dev">Dev (latest main branch)</option>
        </select>
        {state.releaseTrack === "dev" && (
          <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800" data-testid="release-track-warning">
            Dev builds may be unstable. Use for testing only.
          </div>
        )}
      </section>

      {/* GPU type selector */}
      {allEnabled.some((s) => s.gpu) && (
        <section>
          <h3 className="mb-3 text-sm font-medium">GPU Acceleration</h3>
          <select
            value={state.gpuType}
            onChange={(e) => {
              const gpuType = e.target.value as import("../../types/wizard").GpuType;
              dispatch({ type: "SET_GPU_TYPE", gpuType });
              dispatch({ type: "SET_GPU_ENABLED", enabled: gpuType !== "none" });
            }}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          >
            <option value="nvidia">NVIDIA (CUDA)</option>
            <option value="amd">AMD (Vulkan) — recommended for single GPU</option>
            <option value="amd-rocm">AMD (ROCm) — better for multi-GPU</option>
            <option value="none">No GPU (CPU-only)</option>
          </select>
          <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
            {state.gpuType === "nvidia" && "Requires NVIDIA Container Toolkit installed on the host."}
            {state.gpuType === "amd" && "Uses Vulkan for GPU inference. Best single-GPU token generation speed."}
            {state.gpuType === "amd-rocm" && "Uses ROCm/hipBLAS. Better prompt processing and multi-GPU support."}
            {state.gpuType === "none" && "CPU-only inference with OpenBLAS. Functional but significantly slower."}
          </p>
        </section>
      )}

      {/* Jarvis Relay */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Enable Jarvis Relay</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Routes OAuth callbacks through a cloud relay for external providers (Google, Spotify, etc.)
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.relayEnabled}
            data-testid="toggle-relay"
            onClick={() => dispatch({ type: "SET_RELAY_ENABLED", enabled: !state.relayEnabled })}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              state.relayEnabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-bg-tertiary)]"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                state.relayEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {state.relayEnabled && (
          <div className="mt-3">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Relay URL</label>
            <input
              type="url"
              value={state.relayUrl}
              onChange={(e) => dispatch({ type: "SET_RELAY_URL", url: e.target.value })}
              placeholder="https://relay.jarvisautomation.io"
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            />
          </div>
        )}
      </section>

      {/* Secrets */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">Secrets</h3>
          <button
            type="button"
            onClick={handleRegenerateAll}
            className="rounded-md bg-[var(--color-bg-tertiary)] px-3 py-1 text-xs hover:bg-[var(--color-border)]"
            data-testid="regenerate-all"
          >
            Regenerate All
          </button>
        </div>
        <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
          Auto-generated secure tokens. These will be included in your .env file.
        </p>
        <div className="space-y-2">
          {Object.entries(state.secrets).map(([name, value]) => (
            <SecretRow key={name} name={name} value={value} />
          ))}
        </div>
      </section>

      {/* Database */}
      <section>
        <h3 className="mb-3 text-sm font-medium">Database</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="db-user" className="block text-xs text-[var(--color-text-secondary)]">
              Database User
            </label>
            <input
              id="db-user"
              type="text"
              value={state.dbUser}
              onChange={(e) => dispatch({ type: "SET_DB_USER", user: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
            />
          </div>
          {databases.length > 0 && (
            <div>
              <p className="text-xs text-[var(--color-text-secondary)]">Databases that will be created:</p>
              <ul className="mt-1 list-inside list-disc text-xs text-[var(--color-text-secondary)]">
                {databases.map((db) => (
                  <li key={db}>{db}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PortRow({
  label,
  portVar,
  defaultPort,
  currentPort,
  hasConflict,
  onChange,
}: {
  label: string;
  portVar: string;
  defaultPort: number;
  currentPort: number;
  hasConflict: boolean;
  onChange: (port: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 text-sm">{label}</span>
      <span className="w-48 text-xs text-[var(--color-text-secondary)]">{portVar}</span>
      <input
        type="number"
        value={currentPort}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!isNaN(val)) onChange(val);
        }}
        className={`w-24 rounded-lg border px-3 py-1.5 text-sm ${
          hasConflict
            ? "border-red-400 bg-red-50 text-red-800"
            : "border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
        }`}
        data-testid={`port-${portVar}`}
      />
      {currentPort !== defaultPort && (
        <button
          type="button"
          onClick={() => onChange(defaultPort)}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          Reset ({defaultPort})
        </button>
      )}
    </div>
  );
}

function InfraPortRow({
  name,
  description,
  portVar,
  defaultPort,
  currentPort,
  hasConflict,
  onChange,
}: {
  name: string;
  description: string;
  portVar: string;
  defaultPort: number;
  currentPort: number;
  hasConflict: boolean;
  onChange: (port: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-40">
        <span className="text-sm">{name}</span>
        <p className="text-[10px] leading-tight text-[var(--color-text-secondary)]">{description}</p>
      </div>
      <span className="w-48 text-xs text-[var(--color-text-secondary)]">{portVar}</span>
      <input
        type="number"
        value={currentPort}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!isNaN(val)) onChange(val);
        }}
        className={`w-24 rounded-lg border px-3 py-1.5 text-sm ${
          hasConflict
            ? "border-red-400 bg-red-50 text-red-800"
            : "border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
        }`}
        data-testid={`port-${portVar}`}
      />
      {currentPort !== defaultPort && (
        <button
          type="button"
          onClick={() => onChange(defaultPort)}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          Reset ({defaultPort})
        </button>
      )}
    </div>
  );
}

function SecretRow({ name, value }: { name: string; value: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  const displayValue = visible ? value : "••••••••••••••••";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2">
      <span className="w-56 text-xs font-medium">{name}</span>
      <code className="flex-1 truncate text-xs text-[var(--color-text-secondary)]">
        {displayValue}
      </code>
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="rounded-md bg-[var(--color-bg-tertiary)] px-2 py-1 text-xs hover:bg-[var(--color-border)]"
      >
        {visible ? "Hide" : "Show"}
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-md bg-[var(--color-bg-tertiary)] px-2 py-1 text-xs hover:bg-[var(--color-border)]"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
