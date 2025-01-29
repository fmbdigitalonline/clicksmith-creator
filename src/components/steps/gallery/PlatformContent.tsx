import { useState } from "react";
import AdPreviewCard from "./components/AdPreviewCard";
import { AD_FORMATS } from "./components/AdSizeSelector";

interface PlatformContentProps {
  variants: any[];
  onCreateProject: () => void;
  isVideo?: boolean;
}

const PlatformContent = ({ variants, onCreateProject, isVideo = false }: PlatformContentProps) => {
  const [selectedFormat, setSelectedFormat] = useState(AD_FORMATS[0]); // Default to landscape

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {variants.map((variant) => (
        <AdPreviewCard
          key={variant.id}
          variant={variant}
          onCreateProject={onCreateProject}
          isVideo={isVideo}
          selectedFormat={selectedFormat}
          onFormatChange={setSelectedFormat}
        />
      ))}
    </div>
  );
};

export default PlatformContent;