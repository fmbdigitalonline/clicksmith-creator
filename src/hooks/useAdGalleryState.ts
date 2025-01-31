import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCreditsManagement } from '@/hooks/useCreditsManagement';

export const useAdGalleryState = (userId: string | undefined) => {
  const [currentAds, setCurrentAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const { toast } = useToast();
  const { checkCredits } = useCreditsManagement();

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

        if (error && error.code !== 'PGRST116') {
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
    if (!userId || saveInProgress) return;

    try {
      setSaveInProgress(true);
      console.log('[useAdGalleryState] Starting save operation for ads:', ads.length);

      // Check credits before saving
      const hasCredits = await checkCredits(1);
      if (!hasCredits) {
        console.log('[useAdGalleryState] No credits available for saving');
        return;
      }

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
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setCurrentAds(ads);
      console.log('[useAdGalleryState] Successfully saved ads');
    } catch (error) {
      console.error('[useAdGalleryState] Error saving ads:', error);
      toast({
        title: "Error saving ads",
        description: "There was an error saving your ads. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaveInProgress(false);
    }
  };

  const clearGeneratedAds = async () => {
    if (!userId || saveInProgress) return;

    try {
      setSaveInProgress(true);
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
    } finally {
      setSaveInProgress(false);
    }
  };

  return {
    currentAds,
    setCurrentAds,
    isLoading,
    saveGeneratedAds,
    clearGeneratedAds,
    saveInProgress
  };
};