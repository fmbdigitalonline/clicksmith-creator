import { TabsContent } from "@/components/ui/tabs";
import { AdSizeSelector, AD_FORMATS } from "./AdSizeSelector";
import PlatformContent from "../PlatformContent";

interface GalleryContentProps {
  platformName: string;
  displayAds: any[];
  onCreateProject: () => void;
  videoAdsEnabled: boolean;
  selectedFormat: typeof AD_FORMATS[0];
  onFormatChange: (format: typeof AD_FORMATS[0]) => void;
}

export const GalleryContent = ({
  platformName,
  displayAds,
  onCreateProject,
  videoAdsEnabled,
  selectedFormat,
  onFormatChange
}: GalleryContentProps) => {
  return (
    <TabsContent value={platformName} className="space-y-4">
      <div className="flex justify-end mb-4">
        <AdSizeSelector
          selectedFormat={selectedFormat}
          onFormatChange={onFormatChange}
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