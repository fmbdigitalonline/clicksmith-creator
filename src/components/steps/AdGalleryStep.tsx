import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import AdGalleryContent from "./gallery/AdGalleryContent";

interface AdGalleryStepProps {
  businessIdea: BusinessIdea;
  targetAudience: TargetAudience;
  adHooks: AdHook[];
  onStartOver: () => void;
  onBack: () => void;
  onCreateProject: () => void;
  videoAdsEnabled?: boolean;
  generatedAds?: any[];
  hasLoadedInitialAds?: boolean;
}

const AdGalleryStep = (props: AdGalleryStepProps) => {
  return <AdGalleryContent {...props} />;
};

export default AdGalleryStep;