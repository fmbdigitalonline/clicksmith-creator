import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import StepNavigation from "../complete/StepNavigation";

interface AdGenerationControlsProps {
  onBack: () => void;
  onStartOver: () => void;
  onRegenerate: () => void;
  isGenerating: boolean;
  generationStatus: string;
}

const AdGenerationControls = ({
  onBack,
  onStartOver,
  onRegenerate,
  isGenerating,
  generationStatus,
}: AdGenerationControlsProps) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
      <StepNavigation
        onBack={onBack}
        onStartOver={onStartOver}
      />
      <div className="flex flex-col items-end gap-2 w-full md:w-auto">
        {generationStatus && (
          <p className="text-sm text-gray-600">{generationStatus}</p>
        )}
        <Button
          onClick={onRegenerate}
          disabled={isGenerating}
          variant="outline"
          className="w-full md:w-auto"
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          <span>Regenerate Ads</span>
        </Button>
      </div>
    </div>
  );
};

export default AdGenerationControls;