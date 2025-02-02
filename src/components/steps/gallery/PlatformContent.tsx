import { useState } from "react";
import AdPreviewCard from "./components/AdPreviewCard";
import { AD_FORMATS } from "./components/AdSizeSelector";

interface PlatformContentProps {
  platformName: string;
  adVariants: any[];
  onCreateProject: () => void;
  videoAdsEnabled?: boolean;
  selectedFormat?: { width: number; height: number; label: string };
}

const PlatformContent = ({
  platformName,
  adVariants,
  onCreateProject,
  videoAdsEnabled = false,
  selectedFormat: initialFormat
}: PlatformContentProps) => {
  const [selectedFormat, setSelectedFormat] = useState(initialFormat || AD_FORMATS[0]);

  console.log(`[PlatformContent] Rendering ${platformName} variants:`, adVariants);

  // Case-insensitive platform filtering while maintaining null/undefined checks
  const filteredVariants = adVariants.filter(variant => 
    variant && 
    variant.platform && 
    variant.platform.toLowerCase() === platformName.toLowerCase() &&
    variant.headline && // Ensure required fields exist
    (variant.imageUrl || variant.image?.url)
  );

  console.log(`[PlatformContent] Filtered ${platformName} variants:`, filteredVariants);

  if (!Array.isArray(filteredVariants) || filteredVariants.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No ads generated yet for {platformName}. Click "Generate Ads" to create some!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {filteredVariants.map((variant) => (
        <AdPreviewCard
          key={variant.id}
          variant={variant}
          onCreateProject={onCreateProject}
          isVideo={videoAdsEnabled}
          selectedFormat={selectedFormat}
          onFormatChange={setSelectedFormat}
        />
      ))}
    </div>
  );
};

export default PlatformContent;