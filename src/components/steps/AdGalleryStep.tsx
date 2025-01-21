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
import { supabase } from "@/integrations/supabase/client";

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
  } = useAdGeneration(businessIdea, targetAudience, adHooks);

  const handleGenerateAds = useCallback(async (selectedPlatform: string) => {
    if (!isGenerating) {
      console.log('[AdGalleryStep] Triggering ad generation for platform:', selectedPlatform);
      const sessionId = localStorage.getItem('anonymous_session_id');
      
      try {
        await generateAds(selectedPlatform);
      } catch (error) {
        console.error('[AdGalleryStep] Error generating ads:', error);
        if (sessionId) {
          // If we have a session ID but generation failed, try to mark it as used
          const { error: updateError } = await supabase
            .from('anonymous_usage')
            .update({ used: true })
            .eq('session_id', sessionId);
            
          if (updateError) {
            console.error('[AdGalleryStep] Error updating anonymous usage:', updateError);
          }
        }
      }
    }
  }, [generateAds, isGenerating]);

  // Effect for initial ad generation
  useEffect(() => {
    const checkAndGenerateAds = async () => {
      if (!hasLoadedInitialAds) {
        console.log('[AdGalleryStep] Waiting for initial load');
        return;
      }

      if (hasGeneratedInitialAds) {
        console.log('[AdGalleryStep] Already generated initial ads');
        return;
      }

      const sessionId = localStorage.getItem('anonymous_session_id');
      const isNewProject = projectId === 'new';
      const existingPlatformAds = generatedAds.filter(ad => ad.platform === platform);
      const shouldGenerateAds = isNewProject || existingPlatformAds.length === 0;

      console.log('[AdGalleryStep] Initial ad generation check:', {
        sessionId,
        hasLoadedInitialAds,
        hasGeneratedInitialAds,
        isNewProject,
        platform,
        existingAdsCount: existingPlatformAds.length,
        shouldGenerateAds
      });

      if (shouldGenerateAds) {
        console.log('[AdGalleryStep] Triggering initial ad generation');
        await handleGenerateAds(platform);
        setHasGeneratedInitialAds(true);
      } else {
        console.log('[AdGalleryStep] Skipping ad generation - ads already exist');
        setHasGeneratedInitialAds(true);
      }
    };

    checkAndGenerateAds();
  }, [hasLoadedInitialAds, hasGeneratedInitialAds, platform, projectId, generatedAds, handleGenerateAds]);

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
      adVariantsCount: adVariants.length,
      currentAdsCount: generatedAds.length
    });

    const updatedAds = isNewProject
      ? adVariants
      : generatedAds.map(existingAd => {
          const newVariant = adVariants.find(
            variant => variant.platform === existingAd.platform && variant.id === existingAd.id
          );
          return newVariant || existingAd;
        });

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

    console.log('[AdGalleryStep] Final ads update:', {
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
          onPlatformChange={handlePlatformChange}
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
