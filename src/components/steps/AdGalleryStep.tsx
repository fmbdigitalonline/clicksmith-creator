import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
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
import { useToast } from "@/hooks/use-toast";
import logger from "@/utils/logger";

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
  const [isInitialGenerationDone, setIsInitialGenerationDone] = useState(false);
  const { projectId } = useParams();
  const { toast } = useToast();

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

  const showPlatformWarning = (platformName: string) => {
    if (platformName === 'linkedin' || platformName === 'tiktok') {
      toast({
        title: `${platformName === 'linkedin' ? 'LinkedIn' : 'TikTok'} Ad Generation`,
        description: `Please note that ${platformName === 'linkedin' ? 'LinkedIn' : 'TikTok'} ad generation is currently in beta. Some features may be limited.`,
        variant: "warning",
      });
    }
  };

  const handleGenerateAds = useCallback(async (selectedPlatform: string) => {
    if (!isGenerating) {
      logger.info('[AdGalleryStep] Generating ads for platform:', {
        component: 'AdGalleryStep',
        action: 'generateAds',
        details: { selectedPlatform, businessIdea, targetAudience }
      });
      
      showPlatformWarning(selectedPlatform);
      
      try {
        setGeneratedPlatforms(prev => {
          const newSet = new Set(prev);
          newSet.delete(selectedPlatform);
          return newSet;
        });
        
        const success = await generateAds(selectedPlatform);
        if (success) {
          logger.info('[AdGalleryStep] Successfully generated ads:', {
            component: 'AdGalleryStep',
            action: 'generateAds',
            details: { selectedPlatform, count: adVariants.length }
          });
          setGeneratedPlatforms(prev => new Set([...prev, selectedPlatform]));
        } else {
          logger.error('[AdGalleryStep] Failed to generate ads:', {
            component: 'AdGalleryStep',
            action: 'generateAds',
            details: { selectedPlatform }
          });
          setGeneratedPlatforms(prev => {
            const newSet = new Set(prev);
            newSet.delete(selectedPlatform);
            return newSet;
          });
        }
      } catch (error) {
        logger.error('[AdGalleryStep] Error generating ads:', {
          component: 'AdGalleryStep',
          action: 'generateAds',
          error,
          details: { selectedPlatform }
        });
        toast({
          title: "Error Generating Ads",
          description: "There was an error generating your ads. Please try again.",
          variant: "destructive",
        });
        
        setGeneratedPlatforms(prev => {
          const newSet = new Set(prev);
          newSet.delete(selectedPlatform);
          return newSet;
        });
      }
    }
  }, [generateAds, isGenerating, toast, businessIdea, targetAudience, adVariants.length]);

  useEffect(() => {
    if (!hasLoadedInitialAds || isInitialGenerationDone) return;

    const isNewProject = projectId === 'new';
    const existingPlatformAds = generatedAds.filter(ad => ad.platform === platform);
    const shouldGenerateAds = isNewProject || existingPlatformAds.length === 0;

    logger.info('[AdGalleryStep] Initial ad generation check:', {
      component: 'AdGalleryStep',
      action: 'checkInitialGeneration',
      details: {
        hasLoadedInitialAds,
        generatedPlatforms: Array.from(generatedPlatforms),
        isNewProject,
        platform,
        existingAdsCount: existingPlatformAds.length,
        shouldGenerateAds,
        isInitialGenerationDone
      }
    });

    if (shouldGenerateAds && !generatedPlatforms.has(platform)) {
      logger.info('[AdGalleryStep] Triggering initial generation:', {
        component: 'AdGalleryStep',
        action: 'initialGeneration',
        details: { platform }
      });
      handleGenerateAds(platform);
      setIsInitialGenerationDone(true);
    }
  }, [hasLoadedInitialAds, platform, projectId, generatedAds, handleGenerateAds, generatedPlatforms, isInitialGenerationDone]);

  useEffect(() => {
    if (!onAdsGenerated || adVariants.length === 0) {
      logger.info('[AdGalleryStep] Skipping ad state update:', {
        component: 'AdGalleryStep',
        action: 'updateAdState',
        details: {
          hasCallback: !!onAdsGenerated,
          variantsCount: adVariants.length
        }
      });
      return;
    }

    const isNewProject = projectId === 'new';
    logger.info('[AdGalleryStep] Updating ads state:', {
      component: 'AdGalleryStep',
      action: 'updateAdState',
      details: {
        isNewProject,
        platform,
        adVariantsCount: adVariants.length,
        currentAdsCount: generatedAds.length
      }
    });

    let updatedAds;
    if (isNewProject) {
      updatedAds = adVariants;
    } else {
      updatedAds = [...generatedAds];
      updatedAds = updatedAds.filter(ad => ad.platform !== platform);
      updatedAds.push(...adVariants);
    }

    logger.info('[AdGalleryStep] Final ads update:', {
      component: 'AdGalleryStep',
      action: 'updateAdState',
      details: {
        updatedAdsCount: updatedAds.length,
        platform
      }
    });

    onAdsGenerated(updatedAds);
  }, [adVariants, onAdsGenerated, projectId, generatedAds, platform]);

  const onPlatformChange = (newPlatform: "facebook" | "google" | "linkedin" | "tiktok") => {
    handlePlatformChange(newPlatform, adVariants.length > 0);
  };

  const onConfirmPlatformChange = async () => {
    const newPlatform = confirmPlatformChange();
    if (!generatedPlatforms.has(newPlatform)) {
      await handleGenerateAds(newPlatform);
    }
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