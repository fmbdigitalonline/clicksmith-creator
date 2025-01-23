import { Card, CardContent } from "@/components/ui/card";
import { AdFeedbackControls } from "@/components/steps/gallery/components/AdFeedbackControls";
import { useState } from "react";
import { Loader2 } from "lucide-react";

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
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

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
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}
          {imageError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <p className="text-sm text-gray-500">Failed to load image</p>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt="Ad creative"
              className="object-cover w-full h-full"
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ display: imageLoading ? 'none' : 'block' }}
            />
          )}
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