import { useWizardStore } from '@/stores/wizardStore';
import IdeaStep from "../steps/BusinessIdeaStep";
import AudienceStep from "../steps/AudienceStep";
import AudienceAnalysisStep from "../steps/AudienceAnalysisStep";
import AdGalleryStep from "../steps/AdGalleryStep";
import RegistrationWall from "../steps/auth/RegistrationWall";
import { useAuthStore } from '@/stores/authStore';

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
    setBusinessIdea,
    setTargetAudience,
    setAudienceAnalysis,
    handleBack,
    handleStartOver,
    setCurrentStep
  } = useWizardStore();

  const handleIdeaSubmit = (idea: any) => {
    setBusinessIdea(idea);
    setCurrentStep(2);
  };

  const handleAudienceSelect = (audience: any) => {
    setTargetAudience(audience);
    setCurrentStep(3);
  };

  const handleAnalysisComplete = (analysis: any) => {
    setAudienceAnalysis(analysis);
    setCurrentStep(4);
  };

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