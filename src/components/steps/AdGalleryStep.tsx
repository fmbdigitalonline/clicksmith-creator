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
  generatedImages?: AdImage[];
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
  generatedImages,
  onStartOver,
  onBack,
  onCreateProject,
  videoAdsEnabled = false,
  generatedAds = [],
  onAdsGenerated,
  hasLoadedInitialAds = false,
}: AdGalleryStepProps) => {
  const [selectedFormat, setSelectedFormat] = useState(AD_FORMATS[0]);
  const [hasGeneratedInitialAds, setHasGeneratedInitialAds] = useState(false);
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
    reset: resetAdGeneration,
  } = useAdGeneration(businessIdea, targetAudience, adHooks);

  const handleGenerateAds = useCallback((selectedPlatform: string) => {
    if (!isGenerating) {
      console.log('Generating ads for platform:', selectedPlatform);
      generateAds(selectedPlatform);
    }
  }, [generateAds, isGenerating]);

  // Add a wrapper for onStartOver that ensures everything is reset
  const handleStartOver = useCallback(() => {
    resetAdGeneration();
    setHasGeneratedInitialAds(false);
    onStartOver();
  }, [onStartOver, resetAdGeneration]);

  useEffect(() => {
    if (generatedAds.length === 0) {
      console.log('Resetting ad generation state');
      setHasGeneratedInitialAds(false);
      resetAdGeneration();
    }
  }, [generatedAds, resetAdGeneration]);

  useEffect(() => {
    if (!hasLoadedInitialAds) {
      console.log('Initial ads not loaded yet');
      return;
    }

    if (hasGeneratedInitialAds) {
      console.log('Initial ads already generated');
      return;
    }

    const isNewProject = projectId === 'new';
    const existingPlatformAds = generatedAds.filter(ad => ad.platform === platform);
    const shouldGenerateAds = isNewProject || existingPlatformAds.length === 0;

    if (shouldGenerateAds) {
      console.log('Generating initial ads:', { 
        isNewProject, 
        platform, 
        existingAdsCount: existingPlatformAds.length,
        hasGeneratedInitialAds,
        hasLoadedInitialAds
      });
      handleGenerateAds(platform);
      setHasGeneratedInitialAds(true);
    } else {
      console.log('Using existing ads:', {
        platform,
        existingAdsCount: existingPlatformAds.length
      });
      setHasGeneratedInitialAds(true);
    }
  }, [hasLoadedInitialAds, hasGeneratedInitialAds, platform, projectId, generatedAds, handleGenerateAds]);

  useEffect(() => {
    if (!onAdsGenerated || adVariants.length === 0) return;

    const isNewProject = projectId === 'new';
    const updatedAds = isNewProject 
      ? adVariants // For new projects, use only new variants
      : generatedAds.map(existingAd => {
          // Find if there's a new variant for this ad
          const newVariant = adVariants.find(
            variant => variant.platform === existingAd.platform && variant.id === existingAd.id
          );
          return newVariant || existingAd;
        });

    // Add any new variants that don't exist in the current ads
    if (!isNewProject) {
      adVariants.forEach(newVariant => {
        const exists = updatedAds.some(
          ad => ad.platform === newVariant.platform && ad.id === newVariant.id
        );
        if (!exists) {
          updatedAds.push(newVariant);
        }
      });
    }

    console.log('Updating ads state:', { 
      isNewProject, 
      adVariantsCount: adVariants.length,
      updatedAdsCount: updatedAds.length 
    });
    
    onAdsGenerated(updatedAds);
  }, [adVariants, onAdsGenerated, projectId, generatedAds]);

  const onPlatformChange = (newPlatform: "facebook" | "google" | "linkedin" | "tiktok") => {
    handlePlatformChange(newPlatform, adVariants.length > 0);
  };

  const onConfirmPlatformChange = () => {
    const newPlatform = confirmPlatformChange();
    handleGenerateAds(newPlatform);
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

  const renderPlatformContent = (platformName: string) => (
    <TabsContent value={platformName} className="space-y-4">
      <div className="flex justify-end mb-4">
        <AdSizeSelector
          selectedFormat={selectedFormat}
          onFormatChange={handleFormatChange}
        />
      </div>
      <PlatformContent
        platformName={platformName}
        adVariants={generatedAds.length > 0 ? generatedAds : adVariants}
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
