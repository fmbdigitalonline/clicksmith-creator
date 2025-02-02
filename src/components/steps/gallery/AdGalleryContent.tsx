import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAdGalleryState } from "@/hooks/useAdGalleryState";
import { AdSizeSelector, AD_FORMATS } from "./components/AdSizeSelector";
import PlatformTabs from "./PlatformTabs";
import PlatformContent from "./PlatformContent";
import PlatformChangeDialog from "./PlatformChangeDialog";
import LoadingState from "../complete/LoadingState";
import AdGenerationControls from "./AdGenerationControls";
import { useAdGeneration } from "./hooks/useAdGeneration";
import { useInitialGeneration } from "./hooks/useInitialGeneration";
import { usePlatformChange } from "./hooks/usePlatformChange";

interface AdGalleryContentProps {
  userId?: string;
  videoAdsEnabled: boolean;
  onCreateProject: () => void;
  onBack: () => void;
  onStartOver: () => void;
}

const AdGalleryContent = ({
  userId,
  videoAdsEnabled,
  onCreateProject,
  onBack,
  onStartOver,
}: AdGalleryContentProps) => {
  const [selectedFormat, setSelectedFormat] = useState(AD_FORMATS[0]);
  const [isDisplayLoading, setIsDisplayLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [isChangingPlatform, setIsChangingPlatform] = useState(false);

  const {
    currentAds,
    setCurrentAds,
    isLoading: isLoadingState,
    saveGeneratedAds,
    clearGeneratedAds
  } = useAdGalleryState(userId);

  const {
    isGenerating,
    generationStatus,
    generateAds
  } = useAdGeneration(userId, saveGeneratedAds, setCurrentAds, setIsDisplayLoading);

  const {
    currentPlatform,
    handlePlatformTabChange
  } = usePlatformChange(currentAds, setIsDisplayLoading, generateAds);

  useInitialGeneration(
    userId,
    isGenerating,
    isLoadingState,
    currentAds,
    initialLoadDone,
    setInitialLoadDone,
    setIsDisplayLoading,
    generateAds,
    currentPlatform
  );

  const handleRegenerate = async () => {
    try {
      setIsDisplayLoading(true);
      await generateAds(currentPlatform);
    } finally {
      setIsDisplayLoading(false);
    }
  };

  const handleStartOver = async () => {
    await clearGeneratedAds();
    setInitialLoadDone(false);
    onStartOver();
  };

  const handlePlatformChange = (platform: string) => {
    setIsChangingPlatform(true);
    handlePlatformTabChange(platform);
  };

  const handleConfirmPlatformChange = () => {
    setIsChangingPlatform(false);
    // Additional platform change logic if needed
  };

  const handleCancelPlatformChange = () => {
    setIsChangingPlatform(false);
  };

  if (isGenerating || isDisplayLoading || isLoadingState) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <AdGenerationControls
        onRegenerate={handleRegenerate}
        isGenerating={isGenerating}
        generationStatus={generationStatus}
        onStartOver={handleStartOver}
        onBack={onBack}
      />

      <PlatformTabs 
        platform={currentPlatform} 
        onPlatformChange={handlePlatformChange}
      >
        <div className="flex justify-end mb-4">
          <AdSizeSelector
            selectedFormat={selectedFormat}
            onFormatChange={setSelectedFormat}
          />
        </div>
        <PlatformContent
          platformName={currentPlatform}
          adVariants={currentAds}
          onCreateProject={onCreateProject}
          videoAdsEnabled={videoAdsEnabled}
          selectedFormat={selectedFormat}
        />
      </PlatformTabs>

      <PlatformChangeDialog
        open={isChangingPlatform}
        onOpenChange={setIsChangingPlatform}
        onConfirm={handleConfirmPlatformChange}
        onCancel={handleCancelPlatformChange}
      />
    </div>
  );
};

export default AdGalleryContent;