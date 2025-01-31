import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { saveQueue } from "@/utils/saveQueue";

export const useAdGalleryState = (userId?: string) => {
  const [currentAds, setCurrentAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveAttempts, setSaveAttempts] = useState(0);
  const { toast } = useToast();
  const MAX_SAVE_ATTEMPTS = 3;

  const loadSavedAds = useCallback(async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('wizard_progress')
        .select('generated_ads, version')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const generatedAds = data?.generated_ads;
      if (generatedAds && Array.isArray(generatedAds)) {
        console.log('[useAdGalleryState] Loaded saved ads:', generatedAds.length);
        setCurrentAds(generatedAds);
      } else {
        console.log('[useAdGalleryState] No valid generated ads found');
        setCurrentAds([]);
      }
    } catch (error) {
      console.error('[useAdGalleryState] Error loading ads:', error);
      setCurrentAds([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSavedAds();
  }, [userId, loadSavedAds]);

  const saveGeneratedAds = useCallback(async (ads: any[]) => {
    if (!userId || saveAttempts >= MAX_SAVE_ATTEMPTS) return;

    await saveQueue.add(async () => {
      try {
        setSaveAttempts(prev => prev + 1);
        
        const { data: currentData } = await supabase
          .from('wizard_progress')
          .select('version')
          .eq('user_id', userId)
          .single();

        const nextVersion = (currentData?.version || 0) + 1;
        console.log('[useAdGalleryState] Saving ads with version:', nextVersion);

        const { error } = await supabase
          .from('wizard_progress')
          .upsert({
            user_id: userId,
            generated_ads: ads,
            updated_at: new Date().toISOString(),
            version: nextVersion
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;
        
        setCurrentAds(ads);
        setSaveAttempts(0); // Reset attempts on success
      } catch (error) {
        console.error('[useAdGalleryState] Error saving ads:', error);
        
        if (saveAttempts < MAX_SAVE_ATTEMPTS) {
          // Exponential backoff for retries
          const delay = Math.pow(2, saveAttempts) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          await saveGeneratedAds(ads);
        } else {
          toast({
            title: "Error",
            description: "Failed to save generated ads",
            variant: "destructive",
          });
        }
      }
    });
  }, [userId, saveAttempts, toast]);

  const clearGeneratedAds = useCallback(async () => {
    if (!userId) return;
    
    await saveQueue.add(async () => {
      try {
        await saveGeneratedAds([]);
        setCurrentAds([]);
      } catch (error) {
        console.error('[useAdGalleryState] Error clearing ads:', error);
      }
    });
  }, [userId, saveGeneratedAds]);

  return {
    currentAds,
    setCurrentAds,
    isLoading,
    saveGeneratedAds,
    clearGeneratedAds,
  };
};