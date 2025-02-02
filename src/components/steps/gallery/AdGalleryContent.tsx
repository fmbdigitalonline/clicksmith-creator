import { useState, useEffect } from 'react';
import { TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import LoadingState from "../complete/LoadingState";
import PlatformTabs from "./PlatformTabs";
import PlatformContent from "./PlatformContent";
import PlatformChangeDialog from "./PlatformChangeDialog";
import { useAdDisplay } from '@/hooks/useAdDisplay';
import { AdSizeSelector, AD_FORMATS } from "./components/AdSizeSelector";
import { useAdGalleryState } from '@/hooks/useAdGalleryState';
import { usePlatformState } from '@/hooks/usePlatformState';
import { useAdGenerationHandler } from './components/AdGenerationHandler';
import { usePlatformChangeHandler } from './components/PlatformChangeHandler';

interface AdGalleryContentProps {
  businessIdea: any;
  targetAudience: any;
  adHooks: any[];
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
}: AdGalleryContentProps) => {
  const [selectedFormat, setSelectedFormat] = useState(AD_FORMATS[0]);
  const [userId, setUserId] = useState<string | undefined>();
  const [isDisplayLoading, setIsDisplayLoading] = useState(false);

  const {
    currentAds,
    setCurrentAds,
    isLoading: isLoadingState,
    saveGeneratedAds,
    clearGeneratedAds
  } = useAdGalleryState(userId);

  const {
    currentPlatform,
    isChangingPlatform,
    setIsChangingPlatform,
    handlePlatformChange: initiatePlatformChange,
    confirmPlatformChange,
    cancelPlatformChange
  } = usePlatformState();

  const {
    displayAds,
    isLoading: isDisplayLoading,
  } = useAdDisplay(currentAds);

  const {
    handleGeneration,
    handleInitialGeneration,
    isGenerating,
    generationStatus,
  } = useAdGenerationHandler({
    userId,
    currentPlatform,
    setIsDisplayLoading,
    setCurrentAds,
    saveGeneratedAds
  });

  const { handlePlatformChange } = usePlatformChangeHandler({
    handleGeneration,
    confirmPlatformChange,
    cancelPlatformChange
  });

  const handlePlatformTabChange = async (value: string) => {
    console.log('[AdGalleryContent] Platform tab change:', value);
    const hasExistingAds = Array.isArray(displayAds) && displayAds.length > 0;
    
    if (hasExistingAds) {
      initiatePlatformChange(value, hasExistingAds);
    } else {
      await handleGeneration(value);
    }
  };

  const handleRegenerate = async () => {
    console.log('[AdGalleryContent] Regenerating ads for platform:', currentPlatform);
    await handleGeneration(currentPlatform);
  };

  const handleStartOver = async () => {
    await clearGeneratedAds();
    onStartOver();
  };

  useEffect(() => {
    handleInitialGeneration();
  }, [currentPlatform, userId]);

  const renderPlatformContent = (platformName: string) => (
    <TabsContent value={platformName} className="space-y-4">
      <div className="flex justify-end mb-4">
        <AdSizeSelector
          selectedFormat={selectedFormat}
          onFormatChange={setSelectedFormat}
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

  return (
    <div className="space-y-6 md:space-y-8">
      <AdGenerationControls
        onBack={onBack}
        onStartOver={handleStartOver}
        onRegenerate={handleRegenerate}
        isGenerating={isGenerating}
        generationStatus={generationStatus}
      />

      {isGenerating || isDisplayLoading || isLoadingState ? (
        <LoadingState />
      ) : (
        <PlatformTabs 
          platform={currentPlatform} 
          onPlatformChange={handlePlatformTabChange}
        >
          {renderPlatformContent('facebook')}
          {renderPlatformContent('google')}
          {renderPlatformContent('linkedin')}
          {renderPlatformContent('tiktok')}
        </PlatformTabs>
      )}

      <PlatformChangeDialog
        open={isChangingPlatform}
        onOpenChange={setIsChangingPlatform}
        onConfirm={handlePlatformChange}
        onCancel={cancelPlatformChange}
      />
    </div>
  );
};

export default AdGalleryContent;