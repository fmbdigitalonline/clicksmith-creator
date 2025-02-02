import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import { TabsContent } from "@/components/ui/tabs";
import PlatformTabs from "./PlatformTabs";
import PlatformContent from "./PlatformContent";
import PlatformChangeDialog from "./PlatformChangeDialog";
import { useAdDisplay } from "@/hooks/useAdDisplay";
import { AdSizeSelector, AD_FORMATS } from "./components/AdSizeSelector";
import LoadingState from "../complete/LoadingState";
import AdGenerationControls from "./AdGenerationControls";
import { useAdGeneration } from "@/hooks/useAdGeneration";
import { usePlatformState } from "@/hooks/usePlatformState";
import { useAdGalleryState } from "@/hooks/useAdGalleryState";

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
  const [initialLoadDone, setInitialLoadDone] = useState(false);

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

  // Effect to handle initial ad generation
  useEffect(() => {
    const handleInitialGeneration = async () => {
      if (!initialLoadDone && userId && !isGenerating && !isLoadingState && currentAds.length === 0) {
        console.log('[AdGalleryContent] Starting initial ad generation');
        try {
          setIsDisplayLoading(true);
          const newAds = await generateAds(currentPlatform);
          if (newAds && newAds.length > 0) {
            await saveGeneratedAds(newAds);
            setCurrentAds(newAds);
            console.log('[AdGalleryContent] Initial ads generated:', newAds);
            toast({
              title: "Ads Generated",
              description: `Successfully generated ${currentPlatform} ads.`,
            });
          }
        } catch (error) {
          console.error('[AdGalleryContent] Error in initial generation:', error);
          toast({
            title: "Error",
            description: "Failed to generate initial ads. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsDisplayLoading(false);
          setInitialLoadDone(true);
        }
      }
    };

    handleInitialGeneration();
  }, [userId, isGenerating, isLoadingState, currentAds.length, initialLoadDone]);

  const handleFormatChange = (format: typeof AD_FORMATS[0]) => {
    setSelectedFormat(format);
  };

  const handlePlatformTabChange = async (value: string) => {
    console.log('[AdGalleryContent] Platform tab change requested:', value);
    const platformAds = displayAds.filter(ad => 
      ad.platform?.toLowerCase() === value.toLowerCase()
    );
    console.log('[AdGalleryContent] Existing ads for platform:', value, platformAds);
    
    const hasExistingAds = platformAds.length > 0;
    
    if (hasExistingAds) {
      handlePlatformChange(value, hasExistingAds);
    } else {
      try {
        setIsDisplayLoading(true);
        console.log('[AdGalleryContent] Generating new ads for platform:', value);
        const newAds = await generateAds(value);
        if (newAds && newAds.length > 0) {
          console.log('[AdGalleryContent] New ads generated:', newAds);
          await saveGeneratedAds(newAds);
          setCurrentAds(prevAds => [...prevAds, ...newAds]);
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
        console.log('[AdGalleryContent] Platform change ads generated:', newAds);
        await saveGeneratedAds(newAds);
        setCurrentAds(prevAds => [...prevAds, ...newAds]);
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
        await saveGeneratedAds(newAds);
        setCurrentAds(prevAds => {
          // Filter out old ads for current platform
          const otherPlatformAds = prevAds.filter(ad => 
            ad.platform?.toLowerCase() !== currentPlatform.toLowerCase()
          );
          return [...otherPlatformAds, ...newAds];
        });
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