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

  const handleGenerateAds = useCallback(async (selectedPlatform: string) => {
    if (!isGenerating) {
      console.log('[AdGalleryStep] Generating ads for platform:', selectedPlatform);
      showPlatformWarning(selectedPlatform);
      
      try {
        setGeneratedPlatforms(prev => {
          const newSet = new Set(prev);
          newSet.delete(selectedPlatform);
          return newSet;
        });
        
        const success = await generateAds(selectedPlatform);
        if (success) {
          console.log('[AdGalleryStep] Successfully generated ads for:', selectedPlatform);
          setGeneratedPlatforms(prev => new Set([...prev, selectedPlatform]));
        } else {
          console.error('[AdGalleryStep] Failed to generate ads for:', selectedPlatform);
          setGeneratedPlatforms(prev => {
            const newSet = new Set(prev);
            newSet.delete(selectedPlatform);
            return newSet;
          });
        }
      } catch (error) {
        console.error('[AdGalleryStep] Error generating ads:', error);
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
  }, [generateAds, isGenerating, toast]);

  const showPlatformWarning = (platform: string) => {
    if (platform === 'linkedin' || platform === 'tiktok') {
      toast({
        title: `${platform === 'linkedin' ? 'LinkedIn' : 'TikTok'} Ad Generation`,
        description: `Please note that ${platform === 'linkedin' ? 'LinkedIn' : 'TikTok'} ad generation is currently in beta. Some features may be limited.`,
        variant: "warning",
      });
    }
  };

  // Effect for initial ad generation
  useEffect(() => {
    const shouldGenerateInitialAds = 
      hasLoadedInitialAds && 
      !isInitialGenerationDone && 
      !isGenerating && 
      businessIdea && 
      targetAudience &&
      platform && 
      (!generatedAds || generatedAds.length === 0);

    if (shouldGenerateInitialAds) {
      console.log('[AdGalleryStep] Triggering initial ad generation:', {
        platform,
        hasLoadedInitialAds,
        isInitialGenerationDone,
        hasBusinessIdea: !!businessIdea,
        hasTargetAudience: !!targetAudience,
        currentAdsCount: generatedAds?.length
      });
      
      handleGenerateAds(platform);
      setIsInitialGenerationDone(true);
    }
  }, [
    hasLoadedInitialAds,
    isInitialGenerationDone,
    isGenerating,
    businessIdea,
    targetAudience,
    platform,
    generatedAds,
    handleGenerateAds
  ]);

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
      currentAdsCount: generatedAds?.length || 0
    });

    let updatedAds;
    if (isNewProject) {
      updatedAds = adVariants;
    } else {
      updatedAds = [...(Array.isArray(generatedAds) ? generatedAds : [])];
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
    // Ensure generatedAds is always an array
    const safeGeneratedAds = Array.isArray(generatedAds) ? generatedAds : [];
    const platformAds = safeGeneratedAds.filter(ad => ad?.platform === platformName);
    
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