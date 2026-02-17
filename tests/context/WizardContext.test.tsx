import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { WizardProvider, useWizard } from "@/context/WizardContext";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <WizardProvider>{children}</WizardProvider>;
}

describe("WizardContext", () => {
  describe("initial state", () => {
    it("starts at step 0 with 3 total steps", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      expect(result.current.state.currentStep).toBe(0);
      expect(result.current.state.totalSteps).toBe(3);
    });

    it("defaults to empty enabled modules", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      expect(result.current.state.enabledModules).toEqual([]);
    });

    it("defaults to empty port overrides", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      expect(result.current.state.portOverrides).toEqual({});
      expect(result.current.state.infraPortOverrides).toEqual({});
    });

    it("defaults to empty secrets", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      expect(result.current.state.secrets).toEqual({});
    });

    it("defaults to jarvis db user", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      expect(result.current.state.dbUser).toBe("jarvis");
    });

    it("defaults to base.en whisper model", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      expect(result.current.state.whisperModel).toBe("base.en");
    });
  });

  describe("step navigation", () => {
    it("advances to next step", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "NEXT_STEP" }));
      expect(result.current.state.currentStep).toBe(1);
    });

    it("goes back to previous step", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "NEXT_STEP" }));
      act(() => result.current.dispatch({ type: "PREV_STEP" }));
      expect(result.current.state.currentStep).toBe(0);
    });

    it("does not go below step 0", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "PREV_STEP" }));
      expect(result.current.state.currentStep).toBe(0);
    });

    it("does not go above totalSteps - 1", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "SET_STEP", step: 2 }));
      act(() => result.current.dispatch({ type: "NEXT_STEP" }));
      expect(result.current.state.currentStep).toBe(2);
    });

    it("sets step directly", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "SET_STEP", step: 2 }));
      expect(result.current.state.currentStep).toBe(2);
    });

    it("clamps SET_STEP to valid bounds", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "SET_STEP", step: 99 }));
      expect(result.current.state.currentStep).toBe(2);
      act(() => result.current.dispatch({ type: "SET_STEP", step: -5 }));
      expect(result.current.state.currentStep).toBe(0);
    });
  });

  describe("module actions", () => {
    it("sets enabled modules", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() =>
        result.current.dispatch({
          type: "SET_ENABLED_MODULES",
          modules: ["jarvis-recipes-server", "jarvis-ocr-service"],
        }),
      );
      expect(result.current.state.enabledModules).toEqual(["jarvis-recipes-server", "jarvis-ocr-service"]);
    });

    it("toggles a module on", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() =>
        result.current.dispatch({ type: "TOGGLE_MODULE", serviceId: "jarvis-ocr-service", enabled: true }),
      );
      expect(result.current.state.enabledModules).toContain("jarvis-ocr-service");
    });

    it("toggles a module off", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() =>
        result.current.dispatch({
          type: "SET_ENABLED_MODULES",
          modules: ["jarvis-ocr-service", "jarvis-recipes-server"],
        }),
      );
      act(() =>
        result.current.dispatch({ type: "TOGGLE_MODULE", serviceId: "jarvis-recipes-server", enabled: false }),
      );
      expect(result.current.state.enabledModules).not.toContain("jarvis-recipes-server");
    });

    it("does not duplicate module when toggling on twice", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() =>
        result.current.dispatch({ type: "TOGGLE_MODULE", serviceId: "jarvis-ocr-service", enabled: true }),
      );
      act(() =>
        result.current.dispatch({ type: "TOGGLE_MODULE", serviceId: "jarvis-ocr-service", enabled: true }),
      );
      const count = result.current.state.enabledModules.filter(
        (m) => m === "jarvis-ocr-service",
      ).length;
      expect(count).toBe(1);
    });
  });

  describe("port override actions", () => {
    it("sets a service port override", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() =>
        result.current.dispatch({ type: "SET_PORT_OVERRIDE", serviceId: "jarvis-auth", port: 9007 }),
      );
      expect(result.current.state.portOverrides["jarvis-auth"]).toBe(9007);
    });

    it("sets an infrastructure port override", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() =>
        result.current.dispatch({ type: "SET_INFRA_PORT_OVERRIDE", infraId: "postgres", port: 5433 }),
      );
      expect(result.current.state.infraPortOverrides["postgres"]).toBe(5433);
    });

    it("preserves existing overrides when setting new ones", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() =>
        result.current.dispatch({ type: "SET_PORT_OVERRIDE", serviceId: "jarvis-auth", port: 9007 }),
      );
      act(() =>
        result.current.dispatch({ type: "SET_PORT_OVERRIDE", serviceId: "jarvis-logs", port: 9006 }),
      );
      expect(result.current.state.portOverrides["jarvis-auth"]).toBe(9007);
      expect(result.current.state.portOverrides["jarvis-logs"]).toBe(9006);
    });
  });

  describe("secret actions", () => {
    it("sets a single secret", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() =>
        result.current.dispatch({ type: "SET_SECRET", name: "AUTH_SECRET_KEY", value: "abc123" }),
      );
      expect(result.current.state.secrets["AUTH_SECRET_KEY"]).toBe("abc123");
    });

    it("regenerates all secrets", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      const newSecrets = { AUTH_SECRET_KEY: "x", POSTGRES_PASSWORD: "y" };
      act(() =>
        result.current.dispatch({ type: "REGENERATE_SECRETS", secrets: newSecrets }),
      );
      expect(result.current.state.secrets).toEqual(newSecrets);
    });
  });

  describe("database and whisper", () => {
    it("sets db user", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "SET_DB_USER", user: "admin" }));
      expect(result.current.state.dbUser).toBe("admin");
    });

    it("sets whisper model", () => {
      const { result } = renderHook(() => useWizard(), { wrapper });
      act(() => result.current.dispatch({ type: "SET_WHISPER_MODEL", model: "large-v3" }));
      expect(result.current.state.whisperModel).toBe("large-v3");
    });
  });
});
