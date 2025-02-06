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

  console.log(`[PlatformContent] Starting to filter variants for platform: ${platformName}`);
  console.log(`[PlatformContent] Total variants before filtering:`, adVariants.length);

  // Ensure case-insensitive platform matching and handle null/undefined values
  const filteredVariants = adVariants.filter(variant => {
    if (!variant) {
      console.log(`[PlatformContent] Skipping null/undefined variant`);
      return false;
    }

    const variantPlatform = variant.platform?.toLowerCase() || '';
    const requestedPlatform = platformName.toLowerCase();
    
    const isMatchingPlatform = variantPlatform === requestedPlatform;
    const hasRequiredFields = variant.headline && (variant.imageUrl || variant.image?.url);

    console.log(`[PlatformContent] Checking variant:`, {
      variantId: variant.id,
      variantPlatform,
      requestedPlatform,
      isMatchingPlatform,
      hasRequiredFields,
      headline: variant.headline,
      imageUrl: variant.imageUrl || variant.image?.url
    });

    return isMatchingPlatform && hasRequiredFields;
  });

  console.log(`[PlatformContent] Filtered variants for ${platformName}:`, {
    totalVariants: adVariants.length,
    filteredCount: filteredVariants.length,
    variants: filteredVariants
  });

  if (!Array.isArray(filteredVariants) || filteredVariants.length === 0) {
    console.log(`[PlatformContent] No valid variants found for platform: ${platformName}`);
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