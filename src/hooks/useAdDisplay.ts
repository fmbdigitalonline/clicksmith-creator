import { useState, useEffect } from 'react';
import { toast } from "@/hooks/use-toast";

export const useAdDisplay = (generatedAds: any[] = []) => {
  const [displayAds, setDisplayAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (Array.isArray(generatedAds) && generatedAds.length > 0) {
      console.log('[useAdDisplay] Setting display ads:', generatedAds);
      try {
        setDisplayAds(generatedAds.map(ad => ({
          ...ad,
          id: ad.id || crypto.randomUUID()
        })));
      } catch (error) {
        console.error('[useAdDisplay] Error processing ads:', error);
        handleAdError(error as Error);
      }
    } else {
      console.log('[useAdDisplay] No ads to display or invalid format:', generatedAds);
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