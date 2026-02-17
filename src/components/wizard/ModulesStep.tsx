import { useEffect, useState } from "react";
import { useWizard } from "@/context/WizardContext";
import { parseRegistry, getCoreServices, getOptionalServices } from "@/lib/service-registry";
import { resolveModuleToggle } from "@/lib/dependency-resolver";
import type { ServiceRegistry, ServiceDefinition } from "@/types/service-registry";

export default function ModulesStep() {
  const { state, dispatch } = useWizard();
  const [registry, setRegistry] = useState<ServiceRegistry | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}service-registry.json`)
      .then((res) => res.json())
      .then((json) => setRegistry(parseRegistry(json)));
  }, []);

  if (!registry) {
    return <div>Loading modules...</div>;
  }

  const coreServices = getCoreServices(registry);
  const optionalServices = getOptionalServices(registry);

  function handleToggle(serviceId: string, enabled: boolean) {
    const result = resolveModuleToggle(registry!, state.enabledModules, serviceId, enabled);
    dispatch({ type: "SET_ENABLED_MODULES", modules: result.enabled });
  }

  const WAKE_WORDS = ["jarvis", "hey jarvis", "computer", "alexa"];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Modules</h2>

      {/* Wake word */}
      <div className="space-y-1">
        <label htmlFor="wake-word" className="block text-sm font-medium">
          Wake Word
        </label>
        <select
          id="wake-word"
          value={state.wakeWord}
          onChange={(e) => dispatch({ type: "SET_WAKE_WORD", wakeWord: e.target.value })}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
        >
          {WAKE_WORDS.map((word) => (
            <option key={word} value={word}>
              {word}
            </option>
          ))}
        </select>
      </div>

      {/* Core services (always on) */}
      <div data-testid="core-services">
        <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
          Core Services (always included)
        </h3>
        <div className="space-y-2">
          {coreServices.map((service) => (
            <ServiceCard key={service.id} service={service} alwaysOn />
          ))}
        </div>
      </div>

      {/* Optional services */}
      <div data-testid="optional-services">
        <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
          Optional Modules
        </h3>
        <div className="space-y-2">
          {optionalServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              enabled={state.enabledModules.includes(service.id)}
              onToggle={(enabled) => handleToggle(service.id, enabled)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ServiceCard({
  service,
  alwaysOn,
  enabled,
  onToggle,
}: {
  service: ServiceDefinition;
  alwaysOn?: boolean;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
      <div className="flex-1">
        <span className="text-sm font-medium">{service.name}</span>
        <p className="text-xs text-[var(--color-text-secondary)]">{service.description}</p>
      </div>
      {alwaysOn ? (
        <span className="text-xs text-[var(--color-success)]">Always on</span>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          data-testid={`toggle-${service.id}`}
          onClick={() => onToggle?.(!enabled)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            enabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-bg-tertiary)]"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      )}
    </div>
  );
}
