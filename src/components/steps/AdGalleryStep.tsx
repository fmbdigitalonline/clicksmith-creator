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

  const showPlatformWarning = (platform: string) => {
    if (platform === 'linkedin' || platform === 'tiktok') {
      toast({
        title: `${platform === 'linkedin' ? 'LinkedIn' : 'TikTok'} Ad Generation`,
        description: `Please note that ${platform === 'linkedin' ? 'LinkedIn' : 'TikTok'} ad generation is currently in beta. Some features may be limited.`,
        variant: "warning",
      });
    }
  };

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
          
          // Only update the state with new variants, don't save them automatically
          if (onAdsGenerated) {
            onAdsGenerated(adVariants.map(ad => ({
              ...ad,
              platform: selectedPlatform,
              id: ad.id || crypto.randomUUID(),
              size: ad.size || {
                width: 1200,
                height: 628,
                label: `${selectedPlatform} Feed`
              }
            })));
          }
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
      }
    }
  }, [generateAds, isGenerating, onAdsGenerated, adVariants, toast]);

  useEffect(() => {
    if (!hasLoadedInitialAds) return;

    const isNewProject = projectId === 'new';
    const existingPlatformAds = generatedAds.filter(ad => ad.platform === platform);
    const shouldGenerateAds = isNewProject || existingPlatformAds.length === 0;

    console.log('[AdGalleryStep] Initial ad generation check:', {
      hasLoadedInitialAds,
      generatedPlatforms: Array.from(generatedPlatforms),
      isNewProject,
      platform,
      existingAdsCount: existingPlatformAds.length,
      shouldGenerateAds
    });

    if (shouldGenerateAds && !generatedPlatforms.has(platform)) {
      console.log('[AdGalleryStep] Triggering initial ad generation for platform:', platform);
      handleGenerateAds(platform);
    }
  }, [hasLoadedInitialAds, platform, projectId, generatedAds, handleGenerateAds, generatedPlatforms]);

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