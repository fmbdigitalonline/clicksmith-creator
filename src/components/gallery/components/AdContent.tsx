import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { ImageOff } from "lucide-react";

interface AdContentProps {
  primaryText?: string;
  headline?: string;
  imageUrl?: string;
}

export const AdContent = ({ primaryText, headline, imageUrl }: AdContentProps) => {
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    if (imageUrl && imageError && retryCount < maxRetries) {
      const retryTimer = setTimeout(() => {
        console.log(`[AdContent] Retrying image load (${retryCount + 1}/${maxRetries}):`, imageUrl);
        setImageError(false);
        setIsImageLoading(true);
        setRetryCount(prev => prev + 1);
      }, 2000); // Retry after 2 seconds

      return () => clearTimeout(retryTimer);
    }
  }, [imageUrl, imageError, retryCount]);

  const handleImageLoad = () => {
    console.log('[AdContent] Image loaded successfully:', imageUrl);
    setIsImageLoading(false);
    setImageError(false);
    setRetryCount(0);
  };

  const handleImageError = () => {
    setIsImageLoading(false);
    setImageError(true);
    console.error('[AdContent] Failed to load image:', imageUrl, 'Attempt:', retryCount + 1);
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

        {imageError && retryCount >= maxRetries && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-500">
            <ImageOff className="w-8 h-8 mb-2" />
            <p className="text-sm">Failed to load image</p>
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