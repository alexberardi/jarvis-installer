import { useWizard } from "@/context/WizardContext";

const WAKE_WORDS = ["jarvis", "hey jarvis", "computer", "alexa"];

export default function IntegrationsStep() {
  const { state, dispatch } = useWizard();
  const { homeAssistant, wakeWord } = state;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Integrations</h2>

      {/* Home Assistant */}
      <div className="space-y-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={homeAssistant.enabled}
            onChange={(e) =>
              dispatch({ type: "SET_HOME_ASSISTANT", config: { enabled: e.target.checked } })
            }
            aria-label="Home Assistant"
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          <div>
            <span className="font-medium">Home Assistant</span>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Connect Jarvis to your Home Assistant instance for smart home control
            </p>
          </div>
        </label>

        {homeAssistant.enabled && (
          <div className="ml-7 space-y-3">
            <div className="space-y-1">
              <label htmlFor="ha-url" className="block text-sm font-medium">
                Home Assistant URL
              </label>
              <input
                id="ha-url"
                type="url"
                value={homeAssistant.url}
                onChange={(e) =>
                  dispatch({ type: "SET_HOME_ASSISTANT", config: { url: e.target.value } })
                }
                placeholder="http://homeassistant.local:8123"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ha-token" className="block text-sm font-medium">
                Access Token
              </label>
              <input
                id="ha-token"
                type="password"
                value={homeAssistant.token}
                onChange={(e) =>
                  dispatch({ type: "SET_HOME_ASSISTANT", config: { token: e.target.value } })
                }
                placeholder="Long-lived access token"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Wake word */}
      <div className="space-y-1">
        <label htmlFor="wake-word" className="block text-sm font-medium">
          Wake Word
        </label>
        <select
          id="wake-word"
          value={wakeWord}
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
    </div>
  );
}
