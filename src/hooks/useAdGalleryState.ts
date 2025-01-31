import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAdGalleryState = (userId: string | undefined) => {
  const [currentAds, setCurrentAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadAds = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('wizard_progress')
          .select('generated_ads,version')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          console.error('[useAdGalleryState] Error loading ads:', error);
          throw error;
        }

        if (data?.generated_ads) {
          // Ensure we're setting an array
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

  const saveGeneratedAds = async (ads: any[]) => {
    if (!userId) return;

    try {
      const { data: existing } = await supabase
        .from('wizard_progress')
        .select('version')
        .eq('user_id', userId)
        .maybeSingle();

      const version = existing?.version || 0;

      const { error } = await supabase
        .from('wizard_progress')
        .upsert({
          user_id: userId,
          generated_ads: ads,
          version: version + 1,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setCurrentAds(ads);
    } catch (error) {
      console.error('[useAdGalleryState] Error saving ads:', error);
      toast({
        title: "Error saving ads",
        description: "There was an error saving your ads. Please try again.",
        variant: "destructive",
      });
    }
  };

  const clearGeneratedAds = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('wizard_progress')
        .update({ generated_ads: [] })
        .eq('user_id', userId);

      if (error) throw error;

      setCurrentAds([]);
    } catch (error) {
      console.error('[useAdGalleryState] Error clearing ads:', error);
      toast({
        title: "Error clearing ads",
        description: "There was an error clearing your ads. Please try again.",
        variant: "destructive",
      });
    }
  };

  return {
    currentAds,
    setCurrentAds,
    isLoading,
    saveGeneratedAds,
    clearGeneratedAds
  };
};