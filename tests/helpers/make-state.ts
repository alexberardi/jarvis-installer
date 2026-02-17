import type { WizardState } from "@/types/wizard";

export function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 0,
    totalSteps: 3,
    enabledModules: [],
    portOverrides: {},
    infraPortOverrides: {},
    secrets: {
      AUTH_SECRET_KEY: "a".repeat(64),
      JARVIS_CONFIG_ADMIN_TOKEN: "b".repeat(64),
      JARVIS_AUTH_ADMIN_TOKEN: "c".repeat(64),
      ADMIN_API_KEY: "d".repeat(64),
      POSTGRES_PASSWORD: "e".repeat(32),
      REDIS_PASSWORD: "f".repeat(32),
    },
    dbUser: "jarvis",
    whisperModel: "base.en",
    ...overrides,
  };
}
