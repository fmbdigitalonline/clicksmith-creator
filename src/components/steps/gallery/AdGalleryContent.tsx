import { useState, useEffect } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import LoadingState from "../complete/LoadingState";
import PlatformTabs from "./PlatformTabs";
import PlatformContent from "./PlatformContent";
import PlatformChangeDialog from "./PlatformChangeDialog";
import { useAdDisplay } from "@/hooks/useAdDisplay";
import AdGenerationControls from "./AdGenerationControls";
import { AdSizeSelector, AD_FORMATS } from "./components/AdSizeSelector";
import { useToast } from "@/hooks/use-toast";
import { useAdGalleryState } from "@/hooks/useAdGalleryState";
import { supabase } from "@/integrations/supabase/client";
import { useAdGeneration } from "@/hooks/useAdGeneration";
import { usePlatformState } from "@/hooks/usePlatformState";

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
    isGenerating,
    generationStatus,
    generateAds
  } = useAdGeneration(businessIdea, targetAudience, adHooks);

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
    setSelectedFormat(format);
  };

  const handlePlatformTabChange = async (value: string) => {
    const hasExistingAds = Array.isArray(displayAds) && displayAds.length > 0;
    
    if (hasExistingAds) {
      handlePlatformChange(value, hasExistingAds);
    } else {
      try {
        setIsDisplayLoading(true);
        const newAds = await generateAds(value);
        if (newAds && newAds.length > 0) {
          const platformAds = newAds.map(ad => ({
            ...ad,
            platform: value.toLowerCase()
          }));
          await saveGeneratedAds(platformAds);
          setCurrentAds(platformAds);
          toast({
            title: "Ads Generated",
            description: `Successfully generated ${value} ads.`,
          });
        }
      } catch (error) {
        console.error('[AdGalleryContent] Error generating ads:', error);
        toast({
          title: "Error",
          description: "Failed to generate ads. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsDisplayLoading(false);
      }
    }
  };

  const handleConfirmPlatformChange = async () => {
    try {
      setIsDisplayLoading(true);
      const confirmedPlatform = confirmPlatformChange();
      
      const newAds = await generateAds(confirmedPlatform);
      if (newAds && newAds.length > 0) {
        const platformAds = newAds.map(ad => ({
          ...ad,
          platform: confirmedPlatform.toLowerCase()
        }));
        await saveGeneratedAds(platformAds);
        setCurrentAds(platformAds);
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
      const newAds = await generateAds(currentPlatform);
      if (newAds && newAds.length > 0) {
        const platformAds = newAds.map(ad => ({
          ...ad,
          platform: currentPlatform.toLowerCase()
        }));
        await saveGeneratedAds(platformAds);
        setCurrentAds(platformAds);
        toast({
          title: "Ads Regenerated",
          description: `Successfully regenerated ${currentPlatform} ads.`,
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
      if (!currentAds.length && !isDisplayLoading && !isGenerating && userId && !initialGenerationDone) {
        try {
          setIsDisplayLoading(true);
          console.log('[AdGalleryContent] Generating initial ads for platform:', currentPlatform);
          const newAds = await generateAds(currentPlatform);
          if (newAds && newAds.length > 0) {
            const platformAds = newAds.map(ad => ({
              ...ad,
              platform: currentPlatform.toLowerCase()
            }));
            console.log('[AdGalleryContent] Successfully generated initial ads:', platformAds);
            await saveGeneratedAds(platformAds);
            setCurrentAds(platformAds);
            setInitialGenerationDone(true);
          }
        } catch (error) {
          console.error('[AdGalleryContent] Error generating initial ads:', error);
        } finally {
          setIsDisplayLoading(false);
        }
      }
    };

    generateInitialAds();
  }, [currentPlatform, currentAds.length, isDisplayLoading, isGenerating, userId, initialGenerationDone]);

  const renderPlatformContent = (platformName: string) => {
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
        onConfirm={handleConfirmPlatformChange}
        onCancel={cancelPlatformChange}
      />
    </div>
  );
};

export default AdGalleryContent;