import { useState } from "react";
import { AdHook, BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { useParams } from "react-router-dom";
import { useWizardProgress } from "./wizard/useWizardProgress";
import { useWizardHandlers } from "./wizard/useWizardHandlers";

export const useAdWizardState = () => {
  const [selectedHooks, setSelectedHooks] = useState<AdHook[]>([]);
  const [generatedAds, setGeneratedAds] = useState<any[]>([]);
  const [adFormat, setAdFormat] = useState<string | null>(null);
  const [videoAdPreferences, setVideoAdPreferences] = useState<any>(null);
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
    businessIdea,
    targetAudience,
    audienceAnalysis,
    selectedHooks,
    generatedAds,
    adFormat,
    videoAdPreferences,
    handleIdeaSubmit,
    handleAudienceSelect,
    handleAnalysisComplete,
    handleBack,
    handleStartOver,
    canNavigateToStep,
    setCurrentStep,
    setBusinessIdea,
    setTargetAudience,
    setAudienceAnalysis,
    setGeneratedAds,
    setAdFormat,
    setVideoAdPreferences,
  };
};

export default useAdWizardState;