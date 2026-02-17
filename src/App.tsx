import { Routes, Route } from "react-router";
import LandingPage from "@/components/landing/LandingPage";
import WizardShell from "@/components/wizard/WizardShell";
import ModulesStep from "@/components/wizard/ModulesStep";
import ConfigurationStep from "@/components/wizard/ConfigurationStep";
import OutputStep from "@/components/wizard/OutputStep";
import { WizardProvider, useWizard } from "@/context/WizardContext";

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
    <ModulesStep key="services" />,
    <ConfigurationStep key="configure" />,
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
