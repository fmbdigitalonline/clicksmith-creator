import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const useAdGeneration = (
  userId: string | undefined,
  saveGeneratedAds: (ads: any[]) => Promise<void>,
  setCurrentAds: React.Dispatch<React.SetStateAction<any[]>>,
  setIsDisplayLoading: (loading: boolean) => void
) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const { toast } = useToast();

  const generateAds = useCallback(async (platform: string) => {
    if (isGenerating) {
      console.log('[useAdGeneration] Generation already in progress');
      return [];
    }

    try {
      setIsGenerating(true);
      setGenerationStatus(`Generating ${platform} ads...`);

      const { data, error } = await supabase.functions.invoke('generate-ad-content', {
        body: { 
          type: 'complete_ads',
          platform,
          userId // Now properly defined from props
        }
      });

      if (error) throw error;

      if (data?.variants) {
        await saveGeneratedAds(data.variants);
        setCurrentAds(prevAds => {
          // Filter out old ads for this platform and add new ones
          const otherPlatformAds = prevAds.filter(ad => 
            ad.platform.toLowerCase() !== platform.toLowerCase()
          );
          return [...otherPlatformAds, ...data.variants];
        });

        toast({
          title: "Success",
          description: `Generated new ${platform} ads successfully!`,
        });
      }

      return data?.variants || [];
    } catch (error) {
      console.error('[useAdGeneration] Error:', error);
      toast({
        title: "Error generating ads",
        description: error instanceof Error ? error.message : "Failed to generate ads",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
      setIsDisplayLoading(false);
    }
  }, [isGenerating, saveGeneratedAds, setCurrentAds, setIsDisplayLoading, toast, userId]);

  return {
    isGenerating,
    generationStatus,
    generateAds
  };
};