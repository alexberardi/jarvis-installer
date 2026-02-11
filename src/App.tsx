import { Routes, Route } from "react-router";
import LandingPage from "@/components/landing/LandingPage";
import WizardShell from "@/components/wizard/WizardShell";
import HardwareStep from "@/components/wizard/HardwareStep";
import IntegrationsStep from "@/components/wizard/IntegrationsStep";
import ModulesStep from "@/components/wizard/ModulesStep";
import OutputStep from "@/components/wizard/OutputStep";
import { WizardProvider } from "@/context/WizardContext";
import { useWizard } from "@/context/WizardContext";

function WizardPage() {
  return (
    <WizardProvider>
      <WizardShell />
      <WizardStepContent />
    </WizardProvider>
  );
}

function WizardStepContent() {
  const { state } = useWizard();
  const steps = [
    <HardwareStep key="hardware" />,
    <IntegrationsStep key="integrations" />,
    <ModulesStep key="modules" />,
    <OutputStep key="output" />,
  ];
  return (
    <div className="mx-auto max-w-3xl px-6">
      {steps[state.currentStep]}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/configurator" element={<WizardPage />} />
    </Routes>
  );
}
