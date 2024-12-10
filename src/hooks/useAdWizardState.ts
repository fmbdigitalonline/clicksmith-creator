import { useState } from "react";
import { BusinessIdea, TargetAudience, AudienceAnalysis, AdFormat, AdHook, AdImage } from "@/types/adWizard";

export const useAdWizardState = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [businessIdea, setBusinessIdea] = useState<BusinessIdea | null>(null);
  const [targetAudience, setTargetAudience] = useState<TargetAudience | null>(null);
  const [audienceAnalysis, setAudienceAnalysis] = useState<AudienceAnalysis | null>(null);
  const [adFormat, setAdFormat] = useState<AdFormat | null>(null);
  const [adHook, setAdHook] = useState<AdHook | null>(null);
  const [adImages, setAdImages] = useState<AdImage[]>([]);

  const handleIdeaSubmit = (idea: BusinessIdea) => {
    setBusinessIdea(idea);
    setCurrentStep(2);
  };

  const handleAudienceSelect = (audience: TargetAudience) => {
    setTargetAudience(audience);
    setCurrentStep(3);
  };

  const handleAnalysisComplete = (analysis: AudienceAnalysis) => {
    setAudienceAnalysis(analysis);
    setCurrentStep(4);
  };

  const handleHookSelect = (hook: AdHook) => {
    setAdHook(hook);
    setCurrentStep(5);
  };

  const handleFormatSelect = (format: AdFormat) => {
    setAdFormat(format);
    setCurrentStep(6);
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const handleStartOver = () => {
    setBusinessIdea(null);
    setTargetAudience(null);
    setAudienceAnalysis(null);
    setAdFormat(null);
    setAdHook(null);
    setAdImages([]);
    setCurrentStep(1);
  };

  const canNavigateToStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return true;
      case 2:
        return !!businessIdea;
      case 3:
        return !!businessIdea && !!targetAudience;
      case 4:
        return !!businessIdea && !!targetAudience && !!audienceAnalysis;
      case 5:
        return !!businessIdea && !!targetAudience && !!audienceAnalysis && !!adHook;
      case 6:
        return !!businessIdea && !!targetAudience && !!audienceAnalysis && !!adHook && !!adFormat;
      default:
        return false;
    }
  };

  return {
    currentStep,
    businessIdea,
    targetAudience,
    audienceAnalysis,
    adFormat,
    adHook,
    adImages,
    setAdImages,
    handleIdeaSubmit,
    handleAudienceSelect,
    handleAnalysisComplete,
    handleHookSelect,
    handleFormatSelect,
    handleBack,
    handleStartOver,
    canNavigateToStep,
  };
};

export default useAdWizardState;