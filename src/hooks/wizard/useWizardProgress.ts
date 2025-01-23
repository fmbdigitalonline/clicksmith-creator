import { useState, useCallback } from "react";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";

export const useWizardProgress = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [businessIdea, setBusinessIdea] = useState<BusinessIdea | null>(null);
  const [targetAudience, setTargetAudience] = useState<TargetAudience | null>(null);
  const [audienceAnalysis, setAudienceAnalysis] = useState<AudienceAnalysis | null>(null);

  const handleBack = useCallback(() => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  }, []);

  const canNavigateToStep = useCallback((step: number): boolean => {
    switch (step) {
      case 1:
        return true;
      case 2:
        return !!businessIdea;
      case 3:
        return !!businessIdea && !!targetAudience;
      case 4:
        return !!businessIdea && !!targetAudience && !!audienceAnalysis;
      default:
        return false;
    }
  }, [businessIdea, targetAudience, audienceAnalysis]);

  return {
    currentStep,
    setCurrentStep,
    businessIdea,
    setBusinessIdea,
    targetAudience,
    setTargetAudience,
    audienceAnalysis,
    setAudienceAnalysis,
    handleBack,
    canNavigateToStep
  };
};