import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface WizardProgressProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  canNavigateToStep: (step: number) => boolean;
  saveProgress?: () => Promise<void>;
}

export const WizardProgress = ({
  currentStep,
  onStepClick,
  canNavigateToStep,
  saveProgress
}: WizardProgressProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleStepClick = async (step: number) => {
    if (!canNavigateToStep(step)) return;
    
    if (saveProgress) {
      await saveProgress();
    }
    
    onStepClick(step);
    navigate(`/ad-wizard/step-${step}`, { replace: true });
  };
  
  // Sync URL state with current step
  useEffect(() => {
    const isAdWizardRoute = location.pathname.includes('ad-wizard');
    const isNewWizard = location.pathname.includes('new');
    
    // Don't sync if we're on the new wizard route
    if (isNewWizard) return;
    
    // Only sync if we're on an ad-wizard route and on step 4
    if (isAdWizardRoute && currentStep === 4) {
      console.log('[WizardProgress] Syncing with step 4');
      handleStepClick(4);
    }
  }, [currentStep, location.pathname]); // Only re-run when these values change

  return (
    <nav aria-label="Progress">
      <ul className="flex space-x-4">
        {Array.from({ length: 4 }, (_, index) => {
          const step = index + 1;
          return (
            <li key={step}>
              <button
                onClick={() => handleStepClick(step)}
                className={cn(
                  'px-4 py-2 rounded',
                  canNavigateToStep(step) ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                )}
              >
                Step {step}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
