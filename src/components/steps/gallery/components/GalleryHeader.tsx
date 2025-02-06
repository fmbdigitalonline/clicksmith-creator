import AdGenerationControls from "../AdGenerationControls";

interface GalleryHeaderProps {
  onBack: () => void;
  onStartOver: () => void;
  onRegenerate: () => void;
  isGenerating: boolean;
  generationStatus: string;
}

export const GalleryHeader = ({
  onBack,
  onStartOver,
  onRegenerate,
  isGenerating,
  generationStatus
}: GalleryHeaderProps) => {
  return (
    <AdGenerationControls
      onBack={onBack}
      onStartOver={onStartOver}
      onRegenerate={onRegenerate}
      isGenerating={isGenerating}
      generationStatus={generationStatus}
    />
  );
};