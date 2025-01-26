import { WizardStateProvider } from "./wizard/WizardStateProvider";
import WizardContent from "./wizard/WizardContent";

const AdWizard = () => {
  return (
    <WizardStateProvider>
      <WizardContent />
    </WizardStateProvider>
  );
};

export default AdWizard;