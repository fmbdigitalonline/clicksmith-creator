import { useState } from 'react';
import { BusinessIdea, TargetAudience, AudienceAnalysis, AdHook } from '@/types/adWizard';
import { useParams } from "react-router-dom";
import { useWizardProgress } from "./wizard/useWizardProgress";
import { useWizardHandlers } from "./wizard/useWizardHandlers";

export const useAdWizardState = () => {
  const [selectedHooks, setSelectedHooks] = useState<AdHook[]>([]);
  const [generatedAds, setGeneratedAds] = useState<any[]>([]);
  const { projectId } = useParams();

  const {
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
  } = useWizardProgress();

  const {
    handleIdeaSubmit,
    handleAudienceSelect,
    handleAnalysisComplete,
    handleStartOver
  } = useWizardHandlers(
    setBusinessIdea,
    setTargetAudience,
    setAudienceAnalysis,
    setCurrentStep,
    projectId
  );

  return {
    currentStep,
    setCurrentStep,
    businessIdea,
    setBusinessIdea,
    targetAudience,
    setTargetAudience,
    audienceAnalysis,
    setAudienceAnalysis,
    selectedHooks,
    setSelectedHooks,
    generatedAds,
    setGeneratedAds,
    handleIdeaSubmit,
    handleAudienceSelect,
    handleAnalysisComplete,
    handleBack,
    handleStartOver,
    canNavigateToStep
  };
};

export default useAdWizardState;