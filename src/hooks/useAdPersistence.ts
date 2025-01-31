import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAdPersistence = (userId: string | undefined) => {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const saveGeneratedAds = async (ads: any[]) => {
    if (!userId || isSaving || !Array.isArray(ads)) return false;

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('wizard_progress')
        .upsert({
          user_id: userId,
          generated_ads: ads,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[useAdPersistence] Error saving ads:', error);
      toast({
        title: "Error saving ads",
        description: "There was an error saving your ads. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const clearGeneratedAds = async () => {
    if (!userId || isSaving) return false;

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('wizard_progress')
        .update({ generated_ads: [] })
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[useAdPersistence] Error clearing ads:', error);
      toast({
        title: "Error clearing ads",
        description: "There was an error clearing your ads. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    saveGeneratedAds,
    clearGeneratedAds
  };
};