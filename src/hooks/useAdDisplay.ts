import { useState, useEffect } from 'react';
import { toast } from "@/hooks/use-toast";

export const useAdDisplay = (generatedAds: any[] = []) => {
  const [displayAds, setDisplayAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (Array.isArray(generatedAds) && generatedAds.length > 0) {
      console.log('[useAdDisplay] Processing generated ads:', generatedAds);
      try {
        const processedAds = generatedAds.map(ad => ({
          ...ad,
          id: ad.id || crypto.randomUUID(),
          platform: ad.platform?.toLowerCase() || 'facebook', // Ensure platform is set and lowercase
          imageUrl: ad.imageUrl || ad.image?.url, // Handle both image formats
          description: ad.description || ad.primaryText // Handle both text formats
        }));
        
        console.log('[useAdDisplay] Processed ads:', processedAds);
        setDisplayAds(processedAds);
      } catch (error) {
        console.error('[useAdDisplay] Error processing ads:', error);
        handleAdError(error as Error);
      }
    } else {
      console.log('[useAdDisplay] No ads to display or invalid format:', generatedAds);
      setDisplayAds([]);
    }
  }, [generatedAds]);

  const handleAdError = (error: Error) => {
    console.error('[useAdDisplay] Error displaying ads:', error);
    toast({
      title: "Error Displaying Ads",
      description: "There was an issue displaying the generated ads. Please try again.",
      variant: "destructive",
    });
  };

  return {
    displayAds,
    isLoading,
    setIsLoading,
    handleAdError
  };
};