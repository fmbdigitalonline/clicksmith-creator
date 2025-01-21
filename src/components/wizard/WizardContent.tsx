import { useMemo } from "react";
import IdeaStep from "../steps/BusinessIdeaStep";
import AudienceStep from "../steps/AudienceStep";
import AudienceAnalysisStep from "../steps/AudienceAnalysisStep";
import AdGalleryStep from "../steps/AdGalleryStep";
import RegistrationWall from "../steps/auth/RegistrationWall";
import { useWizardState } from "./WizardStateProvider";

interface WizardContentProps {
  currentUser: any;
  videoAdsEnabled: boolean;
  generatedAds: any[];
  onAdsGenerated: (ads: any[]) => void;
  hasLoadedInitialAds: boolean;
  onCreateProject: () => void;
}

export const WizardContent = ({
  currentUser,
  videoAdsEnabled,
  generatedAds,
  onAdsGenerated,
  hasLoadedInitialAds,
  onCreateProject,
}: WizardContentProps) => {
  const {
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
  } = useWizardState();

  return useMemo(() => {
    switch (currentStep) {
      case 1:
        return <IdeaStep onNext={handleIdeaSubmit} />;
      case 2:
        return businessIdea ? (
          <AudienceStep
            businessIdea={businessIdea}
            onNext={handleAudienceSelect}
            onBack={handleBack}
          />
        ) : null;
      case 3:
        return businessIdea && targetAudience ? (
          <AudienceAnalysisStep
            businessIdea={businessIdea}
            targetAudience={targetAudience}
            onNext={handleAnalysisComplete}
            onBack={handleBack}
          />
        ) : null;
      case 4:
        if (!currentUser) {
          return <RegistrationWall onBack={handleBack} />;
        }
        return businessIdea && targetAudience && audienceAnalysis ? (
          <AdGalleryStep
            businessIdea={businessIdea}
            targetAudience={targetAudience}
            adHooks={selectedHooks}
            onStartOver={handleStartOver}
            onBack={handleBack}
            onCreateProject={onCreateProject}
            videoAdsEnabled={videoAdsEnabled}
            generatedAds={generatedAds}
            onAdsGenerated={onAdsGenerated}
            hasLoadedInitialAds={hasLoadedInitialAds}
          />
        ) : null;
      default:
        return null;
    }
  }, [
    currentStep,
    businessIdea,
    targetAudience,
    audienceAnalysis,
    selectedHooks,
    videoAdsEnabled,
    generatedAds,
    hasLoadedInitialAds,
    currentUser,
    handleIdeaSubmit,
    handleAudienceSelect,
    handleAnalysisComplete,
    handleBack,
    handleStartOver,
    onCreateProject,
    onAdsGenerated,
  ]);
};