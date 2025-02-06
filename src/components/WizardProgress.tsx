import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWizardPersistence } from "@/hooks/useWizardPersistence";

interface WizardProgressProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  canNavigateToStep: (step: number) => boolean;
}

const steps = [
  { number: 1, title: "Business Idea" },
  { number: 2, title: "Target Audience" },
  { number: 3, title: "Audience Analysis" },
  { number: 4, title: "Ad Gallery" },
];

const WizardProgress = ({
  currentStep,
  onStepClick,
  canNavigateToStep,
}: WizardProgressProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { saveProgress } = useWizardPersistence();
  
  const handleStepClick = useCallback(async (step: number) => {
    if (!canNavigateToStep(step)) return;
    
    // Save current progress before navigation
    await saveProgress();
    
    // Update step and URL
    onStepClick(step);
    navigate(`/ad-wizard/step-${step}`, { replace: true });
  }, [canNavigateToStep, onStepClick, navigate, saveProgress]);
  
  // Sync with URL state if we're on step 4
  useEffect(() => {
    if (location.pathname.includes('ad-wizard') && currentStep === 4) {
      console.log('[WizardProgress] Syncing with step 4');
      handleStepClick(4);
    }
  }, [location.pathname, currentStep, handleStepClick]);

  return (
    <nav aria-label="Progress">
      <ol role="list" className="space-y-4 md:flex md:space-x-8 md:space-y-0">
        {steps.map((step) => (
          <li key={step.title} className="md:flex-1">
            <button
              className={cn(
                "group flex w-full flex-col border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4",
                step.number < currentStep
                  ? "border-facebook hover:border-facebook/80"
                  : step.number === currentStep
                  ? "border-facebook"
                  : "border-gray-200",
                !canNavigateToStep(step.number) && "cursor-not-allowed opacity-50"
              )}
              onClick={() => handleStepClick(step.number)}
              disabled={!canNavigateToStep(step.number)}
            >
              <span className="text-sm font-medium">
                {step.number < currentStep ? (
                  <Check className="h-4 w-4 text-facebook" />
                ) : (
                  <span
                    className={cn(
                      "text-sm font-medium",
                      step.number === currentStep
                        ? "text-facebook"
                        : "text-gray-500"
                    )}
                  >
                    Step {step.number}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  step.number === currentStep
                    ? "text-facebook"
                    : "text-gray-500"
                )}
              >
                {step.title}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default WizardProgress;