import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdPersistence } from './useAdPersistence';
import { useAdGenerationState } from './useAdGenerationState';

export const useAdGalleryState = (userId: string | undefined) => {
  const [currentAds, setCurrentAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const generationInProgress = useRef(false);
  const { toast } = useToast();
  const { savedAds, isLoading: isSaving, saveGeneratedAds, clearGeneratedAds } = useAdPersistence(userId);
  const { isGenerating, generationStatus, generateAds } = useAdGenerationState(userId);

  useEffect(() => {
    const loadAds = async () => {
      if (!userId || generationInProgress.current) {
        setIsLoading(false);
        return;
      }

      try {
        console.log('[useAdGalleryState] Loading ads for user:', userId);
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
          console.log('[useAdGalleryState] Found existing ads:', Array.isArray(data.generated_ads) ? data.generated_ads.length : 0);
          const adsArray = Array.isArray(data.generated_ads) ? data.generated_ads : [];
          setCurrentAds(adsArray);
        } else {
          console.log('[useAdGalleryState] No existing ads found');
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

  const handleGenerateAds = async (platform: string) => {
    if (generationInProgress.current) {
      console.log('[useAdGalleryState] Generation already in progress, skipping');
      return;
    }

    try {
      generationInProgress.current = true;
      const newAds = await generateAds(platform);
      if (newAds.length > 0) {
        await saveGeneratedAds(newAds);
        setCurrentAds(prev => [...prev, ...newAds]);
      }
    } finally {
      generationInProgress.current = false;
    }
  };

  return {
    currentAds,
    setCurrentAds,
    isLoading,
    isSaving,
    isGenerating,
    generationStatus,
    generateAds: handleGenerateAds,
    saveGeneratedAds,
    clearGeneratedAds
  };
};