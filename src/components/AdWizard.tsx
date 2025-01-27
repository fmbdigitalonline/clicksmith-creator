import { WizardStateProvider } from "./wizard/WizardStateProvider";
import WizardContent from "./wizard/WizardContent";

const AdWizard = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <WizardStateProvider>
        <WizardContent />
      </WizardStateProvider>
    </div>
  );
};

export default AdWizard;