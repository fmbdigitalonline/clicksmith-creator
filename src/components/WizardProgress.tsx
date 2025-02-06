import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

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
  
  // Sync with URL state if we're on step 4 or not on the "new" route
  useEffect(() => {
    if (location.pathname.includes('ad-wizard') && 
       (currentStep === 4 || !location.pathname.includes('/new'))) {
      console.log('[WizardProgress] Syncing with step:', currentStep);
      onStepClick(currentStep);
    }
  }, [location.pathname, currentStep, onStepClick]);

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
              onClick={() => canNavigateToStep(step.number) && onStepClick(step.number)}
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