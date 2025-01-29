import { createContext, useContext, ReactNode } from 'react';
import { useWizardLogic } from '@/hooks/wizard/useWizardLogic';

const WizardStateContext = createContext<ReturnType<typeof useWizardLogic> | undefined>(undefined);

export const useWizardState = () => {
  const context = useContext(WizardStateContext);
  if (!context) {
    throw new Error('useWizardState must be used within a WizardStateProvider');
  }
  return context;
};

export const WizardStateProvider = ({ children }: { children: ReactNode }) => {
  const wizardLogic = useWizardLogic();

  return (
    <WizardStateContext.Provider value={wizardLogic}>
      {children}
    </WizardStateContext.Provider>
  );
};

export default WizardStateProvider;