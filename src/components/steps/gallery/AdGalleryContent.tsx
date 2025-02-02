import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { useWizardState } from "../../wizard/WizardStateProvider";
import WizardAuthentication from "../../wizard/WizardAuthentication";
import WizardControls from "../../wizard/WizardControls";
import WizardHeader from "../../wizard/WizardHeader";
import WizardProgress from "../../WizardProgress";
import WizardSteps from "../../wizard/WizardSteps";
import CreateProjectDialog from "../../projects/CreateProjectDialog";
import { Button } from "../../ui/button";
import { Save } from "lucide-react";
import { isBusinessIdea, isTargetAudience, isAudienceAnalysis } from "@/utils/typeGuards";
import PlatformTabs from "./PlatformTabs";
import PlatformContent from "./PlatformContent";
import PlatformChangeDialog from "./PlatformChangeDialog";
import { useAdDisplay } from "@/hooks/useAdDisplay";
import { AdSizeSelector, AD_FORMATS } from "./components/AdSizeSelector";
import LoadingState from "../complete/LoadingState";
import AdGenerationControls from "./AdGenerationControls";
import { useAdGeneration } from "@/hooks/useAdGeneration";
import { usePlatformState } from "@/hooks/usePlatformState";

const AdGalleryContent = ({
  businessIdea,
  targetAudience,
  adHooks,
  onStartOver,
  onBack,
  onCreateProject,
  videoAdsEnabled = false,
}) => {
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
          await saveGeneratedAds(newAds);
          setCurrentAds(newAds);
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
        await saveGeneratedAds(newAds);
        setCurrentAds(newAds);
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
        setCurrentAds(newAds);
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