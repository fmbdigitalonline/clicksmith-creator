import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import { TabsContent } from "@/components/ui/tabs";
import LoadingState from "../complete/LoadingState";
import PlatformTabs from "./PlatformTabs";
import PlatformContent from "./PlatformContent";
import { useAdDisplay } from "@/hooks/useAdDisplay";
import { useState, useEffect } from "react";
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
  const [platformAdsGenerated, setPlatformAdsGenerated] = useState<Record<string, boolean>>({
    facebook: false,
    google: false,
    linkedin: false,
    tiktok: false
  });
  const [initialGenerationAttempted, setInitialGenerationAttempted] = useState(false);

  const {
    currentAds,
    setCurrentAds,
    isLoading: isLoadingState,
    saveGeneratedAds,
    clearGeneratedAds
  } = useAdGalleryState(userId);

  const {
    currentPlatform,
    handlePlatformChange
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
    handleAdError
  } = useAdDisplay(currentAds);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getUser();
  }, []);

  useEffect(() => {
    const generateInitialAds = async () => {
      if (!initialGenerationAttempted && !platformAdsGenerated.facebook && userId) {
        setInitialGenerationAttempted(true);
        await generateAdsForPlatform('facebook');
      }
    };
    generateInitialAds();
  }, [userId, initialGenerationAttempted, platformAdsGenerated.facebook]);

  const handleFormatChange = (format: typeof AD_FORMATS[0]) => {
    setSelectedFormat(format);
  };

  const generateAdsForPlatform = async (platform: string) => {
    try {
      setIsDisplayLoading(true);
      console.log('[AdGalleryContent] Generating ads for platform:', platform);
      const newAds = await generateAds(platform);
      if (newAds && newAds.length > 0) {
        console.log('[AdGalleryContent] Generated ads:', newAds);
        await saveGeneratedAds(newAds);
        setCurrentAds(prevAds => {
          const platformAds = newAds.map(ad => ({
            ...ad,
            platform: platform.toLowerCase()
          }));
          return [...prevAds, ...platformAds];
        });
        setPlatformAdsGenerated(prev => ({ ...prev, [platform.toLowerCase()]: true }));
        toast({
          title: "Ads Generated",
          description: `Successfully generated ${platform} ads.`,
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
  };

  const handlePlatformTabChange = async (value: string) => {
    console.log('[AdGalleryContent] Platform tab change:', value);
    const platformKey = value.toLowerCase();
    const hasGeneratedForPlatform = platformAdsGenerated[platformKey];
    
    handlePlatformChange(value, true);
    
    if (!hasGeneratedForPlatform) {
      await generateAdsForPlatform(value);
    }
  };

  const handleRegenerate = async () => {
    try {
      setIsDisplayLoading(true);
      console.log('[AdGalleryContent] Regenerating ads for platform:', currentPlatform);
      await generateAdsForPlatform(currentPlatform);
    } finally {
      setIsDisplayLoading(false);
    }
  };

  const handleStartOver = async () => {
    await clearGeneratedAds();
    setPlatformAdsGenerated({
      facebook: false,
      google: false,
      linkedin: false,
      tiktok: false
    });
    setInitialGenerationAttempted(false);
    onStartOver();
  };

  const renderPlatformContent = (platformName: string) => {
    const platformAds = displayAds.filter(ad => 
      ad && ad.platform && ad.platform.toLowerCase() === platformName.toLowerCase()
    );
    
    console.log(`[AdGalleryContent] Rendering ${platformName} ads:`, platformAds);

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
    </div>
  );
};

export default AdGalleryContent;