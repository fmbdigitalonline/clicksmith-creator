import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import { TabsContent } from "@/components/ui/tabs";
import LoadingState from "../complete/LoadingState";
import PlatformTabs from "./PlatformTabs";
import PlatformContent from "./PlatformContent";
import PlatformChangeDialog from "./PlatformChangeDialog";
import { usePlatformSwitch } from "@/hooks/usePlatformSwitch";
import { useAdDisplay } from "@/hooks/useAdDisplay";
import { useState, useEffect } from "react";
import AdGenerationControls from "./AdGenerationControls";
import { AdSizeSelector, AD_FORMATS } from "./components/AdSizeSelector";
import { useToast } from "@/hooks/use-toast";
import { useAdGalleryState } from "@/hooks/useAdGalleryState";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformAds } from "@/hooks/usePlatformAds";

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
}: AdGalleryContentProps) => {
  const [selectedFormat, setSelectedFormat] = useState(AD_FORMATS[0]);
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | undefined>();

  const {
    currentAds,
    setCurrentAds,
    isLoading: isLoadingState,
    saveGeneratedAds,
    clearGeneratedAds
  } = useAdGalleryState(userId);

  const {
    platform,
    showPlatformChangeDialog,
    handlePlatformChange,
    confirmPlatformChange,
    cancelPlatformChange,
    setShowPlatformChangeDialog,
    pendingPlatform
  } = usePlatformSwitch();

  const {
    isLoading: isGeneratingPlatformAds,
    isGenerating,
    generationStatus,
    generatePlatformAds,
  } = usePlatformAds(businessIdea, targetAudience, adHooks, platform);

  const {
    displayAds,
    isLoading: isDisplayLoading,
    setIsLoading: setIsDisplayLoading,
  } = useAdDisplay(currentAds);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getUser();
  }, []);

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
      try {
        setIsDisplayLoading(true);
        const newAds = await generatePlatformAds();
        if (newAds.length > 0) {
          await saveGeneratedAds(newAds);
          toast({
            title: "Ads Generated",
            description: `Successfully generated ${value} ads.`,
          });
        }
      } finally {
        setIsDisplayLoading(false);
      }
    }
  };

  const handleConfirmPlatformChange = async () => {
    try {
      setIsDisplayLoading(true);
      const confirmedPlatform = confirmPlatformChange();
      console.log('[AdGalleryContent] Confirmed platform change to:', confirmedPlatform);
      
      const newAds = await generatePlatformAds();
      if (newAds.length > 0) {
        await saveGeneratedAds(newAds);
        toast({
          title: "Ads Generated",
          description: `Successfully generated ${confirmedPlatform} ads.`,
        });
      }
    } catch (error) {
      console.error('[AdGalleryContent] Error generating ads after platform change:', error);
      cancelPlatformChange();
    } finally {
      setIsDisplayLoading(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setIsDisplayLoading(true);
      const newAds = await generatePlatformAds();
      if (newAds.length > 0) {
        await saveGeneratedAds(newAds);
        toast({
          title: "Ads Regenerated",
          description: `Successfully regenerated ${platform} ads.`,
        });
      }
    } finally {
      setIsDisplayLoading(false);
    }
  };

  const handleStartOver = async () => {
    await clearGeneratedAds();
    onStartOver();
  };

  useEffect(() => {
    const generateInitialAds = async () => {
      if (!currentAds.length && !isDisplayLoading && !isGenerating && userId) {
        console.log('[AdGalleryContent] Generating initial ads for platform:', platform);
        try {
          setIsDisplayLoading(true);
          const newAds = await generatePlatformAds();
          if (newAds.length > 0) {
            await saveGeneratedAds(newAds);
          }
        } finally {
          setIsDisplayLoading(false);
        }
      }
    };

    generateInitialAds();
  }, [platform, currentAds.length, isDisplayLoading, isGenerating, userId]);

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
        onStartOver={handleStartOver}
        onRegenerate={handleRegenerate}
        isGenerating={isGenerating}
        generationStatus={generationStatus}
      />

      {isGenerating || isDisplayLoading || isLoadingState || isGeneratingPlatformAds ? (
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
        onConfirm={handleConfirmPlatformChange}
        onCancel={cancelPlatformChange}
      />
    </div>
  );
};

export default AdGalleryContent;