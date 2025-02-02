import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdPersistence } from './useAdPersistence';
import { useAdGenerationState } from './useAdGenerationState';
import { AdVariant, convertJsonToAdVariant, convertAdVariantToJson } from '@/types/adVariant';
import { useAtomicOperation } from './useAtomicOperation';

export const useAdGalleryState = (userId: string | undefined) => {
  const [currentAds, setCurrentAds] = useState<AdVariant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaveTimestamp, setLastSaveTimestamp] = useState<Date | null>(null);
  const { toast } = useToast();
  const { executeAtomically } = useAtomicOperation();
  const { savedAds, isLoading: isSaving, saveGeneratedAds } = useAdPersistence(userId);
  const { isGenerating, generationStatus, generateAds } = useAdGenerationState(userId);

  // Load saved ads from wizard_progress
  useEffect(() => {
    const loadSavedAds = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const result = await executeAtomically(async () => {
          const { data: progressData, error } = await supabase
            .from('wizard_progress')
            .select('generated_ads')
            .eq('user_id', userId)
            .maybeSingle();

          if (error && error.code !== 'PGRST116') {
            throw error;
          }

          if (progressData?.generated_ads) {
            const validAds = Array.isArray(progressData.generated_ads) 
              ? progressData.generated_ads
                  .map(convertJsonToAdVariant)
                  .filter((ad): ad is AdVariant => ad !== null)
              : [];

            console.log('[useAdGalleryState] Loaded ads:', validAds.length);
            return validAds;
          }
          return [];
        }, `load_ads_${userId}`);

        if (result) {
          setCurrentAds(result);
        }
      } catch (error) {
        console.error('[useAdGalleryState] Error loading ads:', error);
        toast({
          title: "Error loading ads",
          description: "Failed to load your saved ads. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedAds();
  }, [userId, executeAtomically, toast]);

  // Save ads to wizard_progress
  const persistAds = async (ads: AdVariant[]) => {
    if (!userId) return;

    try {
      const result = await executeAtomically(async () => {
        // Convert AdVariant[] to Json[] before saving
        const jsonAds = ads.map(convertAdVariantToJson);
        
        const { error } = await supabase
          .from('wizard_progress')
          .update({ 
            generated_ads: jsonAds,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (error) throw error;
        return true;
      }, `save_ads_${userId}`);

      if (result) {
        setLastSaveTimestamp(new Date());
        console.log('[useAdGalleryState] Ads saved successfully');
      }
    } catch (error) {
      console.error('[useAdGalleryState] Error saving ads:', error);
      toast({
        title: "Error saving ads",
        description: "Failed to save your ads. Please try again.",
        variant: "destructive",
      });
    }
  };

  const clearGeneratedAds = async () => {
    if (!userId) return;

    try {
      const result = await executeAtomically(async () => {
        const { error } = await supabase
          .from('wizard_progress')
          .update({ generated_ads: [] })
          .eq('user_id', userId);

        if (error) throw error;
        setCurrentAds([]);
        return true;
      }, `clear_ads_${userId}`);

      if (result) {
        toast({
          title: "Success",
          description: "All generated ads have been cleared.",
        });
      }
    } catch (error) {
      console.error('[useAdGalleryState] Error clearing ads:', error);
      toast({
        title: "Error",
        description: "Failed to clear ads. Please try again.",
        variant: "destructive",
      });
    }
  };

  return {
    currentAds,
    setCurrentAds,
    isLoading,
    isSaving,
    isGenerating,
    generationStatus,
    lastSaveTimestamp,
    generateAds,
    saveGeneratedAds: persistAds,
    clearGeneratedAds
  };
};