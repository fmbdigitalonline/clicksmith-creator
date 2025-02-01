import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdPersistence } from './useAdPersistence';
import { useAdGenerationState } from './useAdGenerationState';

export const useAdGalleryState = (userId: string | undefined) => {
  const [currentAds, setCurrentAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { savedAds, isLoading: isSaving, saveGeneratedAds, clearGeneratedAds } = useAdPersistence(userId);
  const { isGenerating, generationStatus, generateAds } = useAdGenerationState(userId);

  useEffect(() => {
    const loadAds = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('wizard_progress')
          .select('generated_ads')
          .eq('user_id', userId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('[useAdGalleryState] Error loading ads:', error);
          throw error;
        }

        if (data?.generated_ads) {
          const adsArray = Array.isArray(data.generated_ads) ? data.generated_ads : [];
          setCurrentAds(adsArray);
        } else {
          setCurrentAds([]);
        }
      } catch (error) {
        console.error('[useAdGalleryState] Error loading ads:', error);
        toast({
          title: "Error loading ads",
          description: "There was an error loading your ads. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadAds();
  }, [userId, toast]);

  return {
    currentAds,
    setCurrentAds,
    isLoading,
    isSaving,
    isGenerating,
    generationStatus,
    generateAds,
    saveGeneratedAds,
    clearGeneratedAds
  };
};