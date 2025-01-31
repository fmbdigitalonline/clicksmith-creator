import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { saveQueue } from "@/utils/saveQueue";

export const useAdGalleryState = (userId?: string) => {
  const [currentAds, setCurrentAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSavedAds();
  }, [userId]);

  const loadSavedAds = async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('wizard_progress')
        .select('generated_ads')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const generatedAds = data?.generated_ads;
      if (generatedAds && Array.isArray(generatedAds)) {
        setCurrentAds(generatedAds);
      } else {
        console.log('[useAdGalleryState] No valid generated ads found:', generatedAds);
        setCurrentAds([]);
      }
    } catch (error) {
      console.error('[useAdGalleryState] Error loading ads:', error);
      setCurrentAds([]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveGeneratedAds = async (ads: any[]) => {
    if (!userId) return;

    await saveQueue.add(async () => {
      try {
        // First get the current version
        const { data: currentData } = await supabase
          .from('wizard_progress')
          .select('version')
          .eq('user_id', userId)
          .single();

        const nextVersion = (currentData?.version || 0) + 1;

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
      } catch (error) {
        console.error('[useAdGalleryState] Error saving ads:', error);
        toast({
          title: "Error",
          description: "Failed to save generated ads",
          variant: "destructive",
        });
      }
    });
  };

  const clearGeneratedAds = async () => {
    if (!userId) return;
    
    await saveQueue.add(async () => {
      try {
        await saveGeneratedAds([]);
        setCurrentAds([]);
      } catch (error) {
        console.error('[useAdGalleryState] Error clearing ads:', error);
      }
    });
  };

  return {
    currentAds,
    setCurrentAds,
    isLoading,
    saveGeneratedAds,
    clearGeneratedAds,
  };
};