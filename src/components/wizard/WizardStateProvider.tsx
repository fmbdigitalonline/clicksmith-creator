import { createContext, useContext, ReactNode } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";

const WizardStateContext = createContext<ReturnType<typeof useAdWizardState> | undefined>(undefined);

export const useWizardState = () => {
  const context = useContext(WizardStateContext);
  if (!context) {
    throw new Error('useWizardState must be used within a WizardStateProvider');
  }
  return context;
};

export const WizardStateProvider = ({ children }: { children: ReactNode }) => {
  const wizardState = useAdWizardState();
  
  return (
    <WizardStateContext.Provider value={wizardState}>
      {children}
    </WizardStateContext.Provider>
  );
};