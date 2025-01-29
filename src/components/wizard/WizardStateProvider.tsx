import { ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useWizardStore } from '@/stores/wizardStore';

export const useWizardState = () => {
  const authState = useAuthStore();
  const wizardState = useWizardStore();
  return { ...authState, ...wizardState };
};

export const WizardStateProvider = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};

export default WizardStateProvider;