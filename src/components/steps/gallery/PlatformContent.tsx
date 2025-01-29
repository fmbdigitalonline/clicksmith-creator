import { AdCard } from "@/components/gallery/components/AdCard";

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
  selectedFormat
}: PlatformContentProps) => {
  console.log(`[PlatformContent] Rendering ${platformName} variants:`, adVariants);

  // Ensure case-insensitive platform matching and handle null/undefined values
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
        <AdCard
          key={variant.id}
          id={variant.id}
          primaryText={variant.description || variant.primaryText}
          headline={variant.headline}
          imageUrl={variant.imageUrl || variant.image?.url}
          onFeedbackSubmit={onCreateProject}
        />
      ))}
    </div>
  );
};

export default PlatformContent;