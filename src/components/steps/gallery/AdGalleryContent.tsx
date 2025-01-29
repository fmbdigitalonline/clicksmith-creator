import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import { TabsContent } from "@/components/ui/tabs";
import LoadingState from "../complete/LoadingState";
import PlatformTabs from "./PlatformTabs";
import PlatformContent from "./PlatformContent";
import PlatformChangeDialog from "./PlatformChangeDialog";
import { usePlatformSwitch } from "@/hooks/usePlatformSwitch";
import { useAdGeneration } from "./useAdGeneration";
import { useAdDisplay } from "@/hooks/useAdDisplay";
import { useState, useEffect } from "react";
import AdGenerationControls from "./AdGenerationControls";
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
  const [currentAds, setCurrentAds] = useState<any[]>([]);

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

  const {
    displayAds,
    isLoading,
    setIsLoading,
    handleAdError
  } = useAdDisplay(currentAds);

  useEffect(() => {
    console.log('[AdGalleryContent] Current display ads:', displayAds);
  }, [displayAds]);

  const handleFormatChange = (format: typeof AD_FORMATS[0]) => {
    console.log('[AdGalleryContent] Format changed:', format);
    setSelectedFormat(format);
  };

  const handlePlatformTabChange = async (value: string) => {
    console.log('[AdGalleryContent] Platform tab changed:', value);
    const hasExistingAds = Array.isArray(displayAds) && displayAds.length > 0;
    
    if (hasExistingAds) {
      handlePlatformChange(value as any, hasExistingAds);
    } else {
      // Generate new ads for the platform
      setIsLoading(true);
      const newAds = await generateAds(value);
      setCurrentAds(newAds);
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setIsLoading(true);
    const newAds = await generateAds(platform);
    setCurrentAds(newAds);
    setIsLoading(false);
  };

  const renderPlatformContent = (platformName: string) => {
    console.log(`[AdGalleryContent] Rendering ${platformName} ads:`, displayAds);
    
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
          adVariants={displayAds}
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
        onRegenerate={handleRegenerate}
        isGenerating={isGenerating}
        generationStatus={generationStatus}
      />

      {isGenerating || isLoading ? (
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