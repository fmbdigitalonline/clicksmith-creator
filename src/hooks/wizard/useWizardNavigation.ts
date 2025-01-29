import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export const useWizardNavigation = (currentStep: number, projectId?: string) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (currentStep > 0) {
      const path = projectId && projectId !== 'new' 
        ? `/ad-wizard/${projectId}/step-${currentStep}`
        : `/ad-wizard/step-${currentStep}`;
      
      navigate(path, { replace: true });
    }
  }, [currentStep, projectId, navigate]);
};