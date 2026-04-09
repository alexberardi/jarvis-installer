import { useEffect, useState } from "react";
import { useWizard } from "@/context/WizardContext";
import { parseRegistry, getCoreServices, getRecommendedServices } from "@/lib/service-registry";
import { resolveModuleToggle } from "@/lib/dependency-resolver";
import type { ServiceRegistry, ServiceDefinition } from "@/types/service-registry";

export default function ModulesStep() {
  const { state, dispatch } = useWizard();
  const [registry, setRegistry] = useState<ServiceRegistry | null>(null);
  const [disabledCore, setDisabledCore] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}service-registry.json`)
      .then((res) => res.json())
      .then((json) => {
        const reg = parseRegistry(json);
        setRegistry(reg);

        // Auto-enable all core + recommended on first load
        if (state.enabledModules.length === 0) {
          const allCore = getCoreServices(reg).map((s) => s.id);
          const allRecommended = getRecommendedServices(reg).map((s) => s.id);
          dispatch({ type: "SET_ENABLED_MODULES", modules: [...allCore, ...allRecommended] });
        }
      });
  }, []);

  if (!registry) {
    return <div>Loading services...</div>;
  }

  const coreServices = getCoreServices(registry);
  const recommendedServices = getRecommendedServices(registry);

  function handleToggle(serviceId: string, enabled: boolean) {
    const isCoreService = coreServices.some((s) => s.id === serviceId);

    if (isCoreService && !enabled) {
      // Track disabled core services for warning
      setDisabledCore((prev) => new Set([...prev, serviceId]));
    } else if (isCoreService && enabled) {
      setDisabledCore((prev) => {
        const next = new Set(prev);
        next.delete(serviceId);
        return next;
      });
    }

    const result = resolveModuleToggle(registry!, state.enabledModules, serviceId, enabled);
    dispatch({ type: "SET_ENABLED_MODULES", modules: result.enabled });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Select Services</h2>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Choose which Jarvis services to include in your deployment.
      </p>

      {/* Deployment method toggle */}
      <div className="mb-6 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Deployment Method</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {state.deploymentTarget === "standard"
                ? "Download a zip with docker-compose.yml + .env"
                : "Generate a single self-contained docker-compose.yml"}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "SET_DEPLOYMENT_TARGET",
                target: state.deploymentTarget === "standard" ? "compose-export" : "standard",
              })
            }
            className="text-sm text-blue-500 hover:text-blue-600"
            data-testid="toggle-deployment-target"
          >
            {state.deploymentTarget === "standard"
              ? "Want a single compose file instead?"
              : "Switch to standard (zip)"}
          </button>
        </div>
      </div>

      {/* Core services warning */}
      {disabledCore.size > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <strong>Warning:</strong> You have disabled core services ({[...disabledCore].join(", ")}).
          These are required for Jarvis to function and will need to be hosted elsewhere.
        </div>
      )}

      {/* Core services */}
      <div data-testid="core-services">
        <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
          Core Services
        </h3>
        <div className="space-y-2">
          {coreServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              enabled={state.enabledModules.includes(service.id)}
              onToggle={(enabled) => handleToggle(service.id, enabled)}
              isCore
            />
          ))}
        </div>
      </div>

      {/* Recommended services */}
      {recommendedServices.length > 0 && (
        <div data-testid="recommended-services">
          <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
            Recommended Services
          </h3>
          <div className="space-y-2">
            {recommendedServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                enabled={state.enabledModules.includes(service.id)}
                onToggle={(enabled) => handleToggle(service.id, enabled)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceCard({
  service,
  enabled,
  onToggle,
  isCore,
}: {
  service: ServiceDefinition;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  isCore?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
      <div className="flex-1">
        <span className="text-sm font-medium">{service.name}</span>
        <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
          :{service.port}
        </span>
        {isCore && (
          <span className="ml-2 text-xs text-[var(--color-text-secondary)] opacity-60">
            (core)
          </span>
        )}
        <p className="text-xs text-[var(--color-text-secondary)]">{service.description}</p>
      </div>
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
    </div>
  );
}
