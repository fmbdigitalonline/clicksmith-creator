import { Toggle } from "@/components/ui/toggle";
import { Video, Image } from "lucide-react";

interface WizardControlsProps {
  videoAdsEnabled: boolean;
  onVideoAdsToggle: (enabled: boolean) => void;
}

export const WizardControls = ({
  videoAdsEnabled,
  onVideoAdsToggle
}: WizardControlsProps) => {
  return (
    <div className="flex items-center justify-end mb-6 space-x-2">
      <span className="text-sm text-gray-600">Image Ads</span>
      <Toggle
        pressed={videoAdsEnabled}
        onPressedChange={onVideoAdsToggle}
        aria-label="Toggle video ads"
        className="data-[state=on]:bg-facebook"
      >
        {videoAdsEnabled ? (
          <Video className="h-4 w-4" />
        ) : (
          <Image className="h-4 w-4" />
        )}
      </Toggle>
      <span className="text-sm text-gray-600">Video Ads</span>
    </div>
  );
};