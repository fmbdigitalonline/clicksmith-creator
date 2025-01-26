import { useWizardState } from "./WizardStateProvider";
import IdeaStep from "../steps/BusinessIdeaStep";
import AudienceStep from "../steps/AudienceStep";
import AudienceAnalysisStep from "../steps/AudienceAnalysisStep";
import AdGalleryStep from "../steps/AdGalleryStep";
import RegistrationWall from "../steps/auth/RegistrationWall";

interface WizardStepsProps {
  currentUser: any;
  videoAdsEnabled: boolean;
  generatedAds: any[];
  hasLoadedInitialAds: boolean;
  onCreateProject: () => void;
  renderSaveButton: () => JSX.Element | null;
}

const WizardSteps = ({
  currentUser,
  videoAdsEnabled,
  generatedAds,
  hasLoadedInitialAds,
  onCreateProject,
  renderSaveButton
}: WizardStepsProps) => {
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

  switch (currentStep) {
    case 1:
      return (
        <>
          <IdeaStep onNext={handleIdeaSubmit} />
          {renderSaveButton()}
        </>
      );
    case 2:
      return businessIdea ? (
        <>
          <AudienceStep
            businessIdea={businessIdea}
            onNext={handleAudienceSelect}
            onBack={handleBack}
          />
          {renderSaveButton()}
        </>
      ) : null;
    case 3:
      return businessIdea && targetAudience ? (
        <>
          <AudienceAnalysisStep
            businessIdea={businessIdea}
            targetAudience={targetAudience}
            onNext={handleAnalysisComplete}
            onBack={handleBack}
          />
          {renderSaveButton()}
        </>
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
          hasLoadedInitialAds={hasLoadedInitialAds}
        />
      ) : null;
    default:
      return null;
  }
};

export default WizardSteps;