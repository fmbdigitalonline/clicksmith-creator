import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import { TabsContent } from "@/components/ui/tabs";
import LoadingState from "../complete/LoadingState";
import PlatformTabs from "./PlatformTabs";
import PlatformContent from "./PlatformContent";
import PlatformChangeDialog from "./PlatformChangeDialog";
import { usePlatformSwitch } from "@/hooks/usePlatformSwitch";
import { useAdGeneration } from "./useAdGeneration";
import AdGenerationControls from "./AdGenerationControls";
import { useState } from "react";
import { AdSizeSelector, AD_FORMATS } from "./components/AdSizeSelector";

interface AdGalleryContentProps {
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

const AdGalleryContent = ({
  businessIdea,
  targetAudience,
  adHooks,
  onStartOver,
  onBack,
  onCreateProject,
  videoAdsEnabled = false,
  generatedAds = [],
  hasLoadedInitialAds = false,
}: AdGalleryContentProps) => {
  const [selectedFormat, setSelectedFormat] = useState(AD_FORMATS[0]);

  const {
    platform,
    showPlatformChangeDialog,
    handlePlatformChange,
    confirmPlatformChange,
    cancelPlatformChange,
    setShowPlatformChangeDialog
  } = usePlatformSwitch();

  const {
    isGenerating,
    generationStatus,
    generateAds,
  } = useAdGeneration(businessIdea, targetAudience, adHooks);

  const handleFormatChange = (format: typeof AD_FORMATS[0]) => {
    setSelectedFormat(format);
  };

  const handlePlatformTabChange = (value: string) => {
    const hasExistingAds = Array.isArray(generatedAds) && generatedAds.length > 0;
    handlePlatformChange(value as any, hasExistingAds);
  };

  const renderPlatformContent = (platformName: string) => {
    const platformAds = Array.isArray(generatedAds) 
      ? generatedAds.filter(ad => ad.platform === platformName)
      : [];
    
    return (
      <TabsContent value={platformName} className="space-y-4">
        <div className="flex justify-end mb-4">
          <AdSizeSelector
            selectedFormat={selectedFormat}
            onFormatChange={handleFormatChange}
          />
        </div>
        <PlatformContent
          platformName={platformName}
          adVariants={platformAds}
          onCreateProject={onCreateProject}
          videoAdsEnabled={videoAdsEnabled}
          selectedFormat={selectedFormat}
        />
      </TabsContent>
    );
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <AdGenerationControls
        onBack={onBack}
        onStartOver={onStartOver}
        onRegenerate={() => generateAds(platform)}
        isGenerating={isGenerating}
        generationStatus={generationStatus}
      />

      {isGenerating ? (
        <LoadingState />
      ) : (
        <PlatformTabs 
          platform={platform} 
          onPlatformChange={handlePlatformTabChange}
        >
          {renderPlatformContent('facebook')}
          {renderPlatformContent('google')}
          {renderPlatformContent('linkedin')}
          {renderPlatformContent('tiktok')}
        </PlatformTabs>
      )}

      <PlatformChangeDialog
        open={showPlatformChangeDialog}
        onOpenChange={setShowPlatformChangeDialog}
        onConfirm={confirmPlatformChange}
        onCancel={cancelPlatformChange}
      />
    </div>
  );
};

export default AdGalleryContent;