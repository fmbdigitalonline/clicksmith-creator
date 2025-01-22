import { BusinessIdea, TargetAudience, AdHook, AdImage } from "@/types/adWizard";
import { TabsContent } from "@/components/ui/tabs";
import LoadingState from "./complete/LoadingState";
import PlatformTabs from "./gallery/PlatformTabs";
import PlatformContent from "./gallery/PlatformContent";
import PlatformChangeDialog from "./gallery/PlatformChangeDialog";
import { usePlatformSwitch } from "@/hooks/usePlatformSwitch";
import { useAdGeneration } from "./gallery/useAdGeneration";
import AdGenerationControls from "./gallery/AdGenerationControls";
import { useEffect, useState, useCallback } from "react";
import { AdSizeSelector, AD_FORMATS } from "./gallery/components/AdSizeSelector";
import { useParams } from "react-router-dom";

interface AdGalleryStepProps {
  businessIdea: BusinessIdea;
  targetAudience: TargetAudience;
  adHooks: AdHook[];
  onStartOver: () => void;
  onBack: () => void;
  onCreateProject: () => void;
  videoAdsEnabled?: boolean;
  generatedAds?: any[];
  onAdsGenerated?: (ads: any[]) => void;
  hasLoadedInitialAds?: boolean;
}

const AdGalleryStep = ({
  businessIdea,
  targetAudience,
  adHooks,
  onStartOver,
  onBack,
  onCreateProject,
  videoAdsEnabled = false,
  generatedAds = [],
  onAdsGenerated,
  hasLoadedInitialAds = false,
}: AdGalleryStepProps) => {
  const [selectedFormat, setSelectedFormat] = useState(AD_FORMATS[0]);
  const [generatedPlatforms, setGeneratedPlatforms] = useState<Set<string>>(new Set());
  const { projectId } = useParams();
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
    adVariants,
    generationStatus,
    generateAds,
  } = useAdGeneration(businessIdea, targetAudience, adHooks);

  const handleGenerateAds = useCallback(async (selectedPlatform: string) => {
    if (!isGenerating) {
      console.log('[AdGalleryStep] Generating ads for platform:', selectedPlatform);
      await generateAds(selectedPlatform);
      setGeneratedPlatforms(prev => new Set([...prev, selectedPlatform]));
    }
  }, [generateAds, isGenerating]);

  // Effect for initial ad generation
  useEffect(() => {
    if (!hasLoadedInitialAds) return;

    const isNewProject = projectId === 'new';
    const existingPlatformAds = generatedAds.filter(ad => ad.platform === platform);
    const shouldGenerateAds = isNewProject || existingPlatformAds.length === 0 || !generatedPlatforms.has(platform);

    console.log('[AdGalleryStep] Initial ad generation check:', {
      hasLoadedInitialAds,
      generatedPlatforms: Array.from(generatedPlatforms),
      isNewProject,
      platform,
      existingAdsCount: existingPlatformAds.length,
      shouldGenerateAds
    });

    if (shouldGenerateAds) {
      console.log('[AdGalleryStep] Triggering initial ad generation for platform:', platform);
      handleGenerateAds(platform);
    }
  }, [hasLoadedInitialAds, platform, projectId, generatedAds, handleGenerateAds, generatedPlatforms]);

  // Effect for managing generated ads state
  useEffect(() => {
    if (!onAdsGenerated || adVariants.length === 0) {
      console.log('[AdGalleryStep] Skipping ad state update:', {
        hasCallback: !!onAdsGenerated,
        variantsCount: adVariants.length
      });
      return;
    }

    const isNewProject = projectId === 'new';
    console.log('[AdGalleryStep] Updating ads state:', {
      isNewProject,
      platform,
      adVariantsCount: adVariants.length,
      currentAdsCount: generatedAds.length
    });

    let updatedAds;
    if (isNewProject) {
      updatedAds = adVariants;
    } else {
      updatedAds = [...generatedAds];
      updatedAds = updatedAds.filter(ad => ad.platform !== platform);
      updatedAds.push(...adVariants);
    }

    console.log('[AdGalleryStep] Final ads update:', {
      updatedAdsCount: updatedAds.length,
      platform
    });

    onAdsGenerated(updatedAds);
  }, [adVariants, onAdsGenerated, projectId, generatedAds, platform]);

  const onPlatformChange = (newPlatform: "facebook" | "google" | "linkedin" | "tiktok") => {
    handlePlatformChange(newPlatform, adVariants.length > 0);
  };

  const onConfirmPlatformChange = async () => {
    const newPlatform = confirmPlatformChange();
    await handleGenerateAds(newPlatform);
  };

  const onCancelPlatformChange = () => {
    const currentPlatform = cancelPlatformChange();
    const tabsElement = document.querySelector(`[data-state="active"][value="${currentPlatform}"]`);
    if (tabsElement) {
      (tabsElement as HTMLElement).click();
    }
  };

  const handleFormatChange = (format: typeof AD_FORMATS[0]) => {
    setSelectedFormat(format);
  };

  const renderPlatformContent = (platformName: string) => {
    const platformAds = generatedAds.filter(ad => ad.platform === platformName);
    
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
        onRegenerate={() => handleGenerateAds(platform)}
        isGenerating={isGenerating}
        generationStatus={generationStatus}
      />

      {isGenerating ? (
        <LoadingState />
      ) : (
        <PlatformTabs 
          platform={platform} 
          onPlatformChange={onPlatformChange}
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
        onConfirm={onConfirmPlatformChange}
        onCancel={onCancelPlatformChange}
      />
    </div>
  );
};

export default AdGalleryStep;