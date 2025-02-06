import { useState, useEffect } from "react";
import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import LoadingState from "../complete/LoadingState";
import PlatformTabs from "./PlatformTabs";
import PlatformChangeDialog from "./PlatformChangeDialog";
import { useAdDisplay } from "@/hooks/useAdDisplay";
import { AD_FORMATS } from "./components/AdSizeSelector";
import { useAdGalleryState } from "@/hooks/useAdGalleryState";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformState } from "@/hooks/usePlatformState";
import { usePlatformGeneration } from "@/hooks/usePlatformGeneration";
import { GalleryHeader } from "./components/GalleryHeader";
import { GalleryContent } from "./components/GalleryContent";

interface AdGalleryContentProps {
  businessIdea: BusinessIdea;
  targetAudience: TargetAudience;
  adHooks: AdHook[];
  onStartOver: () => void;
  onBack: () => void;
  onCreateProject: () => void;
  videoAdsEnabled?: boolean;
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
  const [initialGenerationDone, setInitialGenerationDone] = useState(false);

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
    handlePlatformChange,
    confirmPlatformChange,
    cancelPlatformChange
  } = usePlatformState();

  const {
    handleGenerateAdsForPlatform,
    isDisplayLoading,
    setIsDisplayLoading,
    isGenerating,
    generationStatus
  } = usePlatformGeneration(
    businessIdea,
    targetAudience,
    adHooks,
    saveGeneratedAds,
    setCurrentAds
  );

  const { displayAds } = useAdDisplay(currentAds);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getUser();
  }, []);

  const handlePlatformTabChange = async (newPlatform: string) => {
    console.log(`[AdGalleryContent] Handling platform change to: ${newPlatform}`);
    const hasExistingAds = Array.isArray(displayAds) && displayAds.length > 0;
    
    if (hasExistingAds) {
      handlePlatformChange(newPlatform, hasExistingAds);
    } else {
      const platform = newPlatform.toLowerCase();
      console.log(`[AdGalleryContent] Generating ads for platform: ${platform}`);
      await handleGenerateAdsForPlatform(platform);
    }
  };

  const handleConfirmPlatformChange = async () => {
    const confirmedPlatform = confirmPlatformChange();
    console.log(`[AdGalleryContent] Confirmed platform change to: ${confirmedPlatform}`);
    await handleGenerateAdsForPlatform(confirmedPlatform);
  };

  const handleRegenerate = async () => {
    console.log(`[AdGalleryContent] Regenerating ads for platform: ${currentPlatform}`);
    await handleGenerateAdsForPlatform(currentPlatform);
  };

  const handleStartOver = async () => {
    await clearGeneratedAds();
    onStartOver();
  };

  useEffect(() => {
    const generateInitialAds = async () => {
      if (!currentAds.length && !isDisplayLoading && !isGenerating && userId && !initialGenerationDone) {
        console.log(`[AdGalleryContent] Generating initial ads for platform: ${currentPlatform}`);
        await handleGenerateAdsForPlatform(currentPlatform);
        setInitialGenerationDone(true);
      }
    };

    generateInitialAds();
  }, [currentPlatform, currentAds.length, isDisplayLoading, isGenerating, userId, initialGenerationDone]);

  return (
    <div className="space-y-6 md:space-y-8">
      <GalleryHeader
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
          {['facebook', 'google', 'linkedin', 'tiktok'].map(platform => (
            <GalleryContent
              key={platform}
              platformName={platform}
              displayAds={displayAds}
              onCreateProject={onCreateProject}
              videoAdsEnabled={videoAdsEnabled}
              selectedFormat={selectedFormat}
              onFormatChange={setSelectedFormat}
            />
          ))}
        </PlatformTabs>
      )}

      <PlatformChangeDialog
        open={isChangingPlatform}
        onOpenChange={setIsChangingPlatform}
        onConfirm={handleConfirmPlatformChange}
        onCancel={cancelPlatformChange}
      />
    </div>
  );
};

export default AdGalleryContent;