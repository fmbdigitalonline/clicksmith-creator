import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

interface AdContentProps {
  primaryText?: string;
  headline?: string;
  imageUrl?: string;
}

export const AdContent = ({ primaryText, headline, imageUrl }: AdContentProps) => {
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setIsImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setIsImageLoading(false);
    setImageError(true);
    console.error('[AdContent] Failed to load image:', imageUrl);
  };

  return (
    <>
      {primaryText && (
        <CardContent className="p-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Primary Text:</p>
            <p className="text-gray-800">{primaryText}</p>
          </div>
        </CardContent>
      )}
      
      <div className="aspect-video relative">
        {isImageLoading && (
          <Skeleton className="w-full h-full absolute inset-0" />
        )}
        
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Ad creative"
            className={`object-cover w-full h-full transition-opacity duration-200 ${
              isImageLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}

        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500">
            <p>Failed to load image</p>
          </div>
        )}
      </div>

      {headline && (
        <CardContent className="p-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Headline:</p>
            <h3 className="text-lg font-semibold text-facebook">{headline}</h3>
          </div>
        </CardContent>
      )}
    </>
  );
};