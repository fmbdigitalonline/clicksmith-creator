import { Card, CardContent } from "@/components/ui/card";
import { AdFeedbackControls } from "@/components/steps/gallery/components/AdFeedbackControls";

interface SavedAdCardProps {
  id: string;
  primaryText?: string;
  headline?: string;
  imageUrl?: string;
  onFeedbackSubmit: () => void;
}

export const SavedAdCard = ({ 
  id, 
  primaryText, 
  headline, 
  imageUrl,
  onFeedbackSubmit 
}: SavedAdCardProps) => {
  return (
    <Card className="overflow-hidden">
      {/* Primary Text Section */}
      {primaryText && (
        <CardContent className="p-4 border-b">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Primary Text</p>
            <p className="text-gray-800 whitespace-pre-wrap">{primaryText}</p>
          </div>
        </CardContent>
      )}
      
      {/* Image Section */}
      {imageUrl && (
        <div className="aspect-video relative">
          <img
            src={imageUrl}
            alt="Ad creative"
            className="object-cover w-full h-full"
          />
        </div>
      )}

      {/* Headline Section */}
      {headline && (
        <CardContent className="p-4 border-t">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Headline</p>
            <h3 className="text-lg font-semibold text-facebook">{headline}</h3>
          </div>
        </CardContent>
      )}

      {/* Feedback Controls */}
      <CardContent className="p-4 border-t bg-gray-50">
        <AdFeedbackControls
          adId={id}
          onFeedbackSubmit={onFeedbackSubmit}
        />
      </CardContent>
    </Card>
  );
};