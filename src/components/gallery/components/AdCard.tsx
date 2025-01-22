import { Card } from "@/components/ui/card";
import { AdContent } from "./AdContent";
import { AdFeedbackControls } from "@/components/steps/gallery/components/AdFeedbackControls";

interface AdCardProps {
  id: string;
  primaryText?: string;
  headline?: string;
  imageUrl?: string;
  onFeedbackSubmit: () => void;
}

export const AdCard = ({ id, primaryText, headline, imageUrl, onFeedbackSubmit }: AdCardProps) => {
  return (
    <Card className="overflow-hidden">
      <AdContent
        primaryText={primaryText}
        headline={headline}
        imageUrl={imageUrl}
      />
      <div className="p-4 border-t bg-gray-50">
        <AdFeedbackControls
          adId={id}
          onFeedbackSubmit={onFeedbackSubmit}
        />
      </div>
    </Card>
  );
};