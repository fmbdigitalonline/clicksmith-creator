import { useState } from "react";
import { AdHook } from "@/types/adWizard";
import { useParams } from "react-router-dom";
import { useWizardProgress } from "./wizard/useWizardProgress";
import { useWizardHandlers } from "./wizard/useWizardHandlers";

export const useAdWizardState = () => {
  const [selectedHooks, setSelectedHooks] = useState<AdHook[]>([]);
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
    handleIdeaSubmit,
    handleAudienceSelect,
    handleAnalysisComplete,
    handleBack,
    handleStartOver,
    canNavigateToStep,
    setCurrentStep,
  };
};

export default useAdWizardState;