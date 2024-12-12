import { AdHook, AdImage, BusinessIdea } from "@/types/adWizard";
import AdVariantCard from "./AdVariantCard";

interface AdVariantGridProps {
  adImages: AdImage[];
  adHooks: AdHook[];
  businessIdea: BusinessIdea;
  onCreateProject: () => void;
  isSaving?: boolean;
}

const AdVariantGrid = ({ adImages, adHooks, onCreateProject, isSaving }: AdVariantGridProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {adImages.map((image, index) => {
        const hook = adHooks[index % adHooks.length];
        return (
          <AdVariantCard
            key={index}
            image={image}
            hook={hook}
            index={index}
            onCreateProject={onCreateProject}
            isSaving={isSaving}
          />
        );
      })}
    </div>
  );
};

export default AdVariantGrid;