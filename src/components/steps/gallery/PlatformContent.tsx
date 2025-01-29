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

  if (!Array.isArray(adVariants) || adVariants.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No ads generated yet for {platformName}. Click "Generate Ads" to create some!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {adVariants.map((variant) => (
        <AdCard
          key={variant.id}
          id={variant.id}
          primaryText={variant.description}
          headline={variant.headline}
          imageUrl={variant.imageUrl}
          onFeedbackSubmit={onCreateProject}
        />
      ))}
    </div>
  );
};

export default PlatformContent;