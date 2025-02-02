import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const useAdGeneration = (
  userId: string | undefined,
  saveGeneratedAds: (ads: any[]) => Promise<void>,
  setCurrentAds: React.Dispatch<React.SetStateAction<any[]>>,
  setIsDisplayLoading: (loading: boolean) => void
) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const { toast } = useToast();

  const generateAds = async (platform: string) => {
    try {
      setIsGenerating(true);
      setGenerationStatus(`Generating ${platform} ads...`);
      console.log(`[useAdGeneration] Starting generation for ${platform}`);

      const newAds = await generateAdsForPlatform(platform);
      
      if (newAds && newAds.length > 0) {
        console.log('[useAdGeneration] New ads generated:', newAds);
        await saveGeneratedAds(newAds);
        
        setCurrentAds(prevAds => {
          const updatedAds = [...prevAds, ...newAds].reduce((acc, ad) => {
            if (!acc.some(existingAd => existingAd.id === ad.id)) {
              acc.push(ad);
            }
            return acc;
          }, []);
          return updatedAds;
        });

        toast({
          title: "Ads Generated",
          description: `Successfully generated ${platform} ads.`,
        });
      }
      
      return newAds;
    } catch (error) {
      console.error('[useAdGeneration] Error generating ads:', error);
      toast({
        title: "Error",
        description: "Failed to generate ads. Please try again.",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsGenerating(false);
      setGenerationStatus("");
      setIsDisplayLoading(false);
    }
  };

  return {
    isGenerating,
    generationStatus,
    generateAds
  };
};

const generateAdsForPlatform = async (platform: string) => {
  const { data, error } = await supabase.functions.invoke('generate-ad-content', {
    body: {
      type: 'complete_ads',
      platform,
      userId,
      numVariants: 10
    },
  });

  if (error) {
    console.error('[generateAdsForPlatform] Error:', error);
    throw error;
  }

  if (!data?.variants || !Array.isArray(data.variants)) {
    throw new Error('Invalid response format from server');
  }

  return data.variants.map(variant => ({
    ...variant,
    platform: platform.toLowerCase(),
    id: variant.id || crypto.randomUUID(),
    headline: variant.headline || variant.hook?.text || 'Untitled Ad',
    description: variant.description || variant.primaryText || '',
    imageUrl: variant.imageUrl || variant.image?.url || '',
  }));
};
