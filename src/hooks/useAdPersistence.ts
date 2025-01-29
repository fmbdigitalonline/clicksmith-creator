import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useAdPersistence = () => {
  const [savedAds, setSavedAds] = useState<any[]>([]);
  const { toast } = useToast();

  const saveGeneratedAds = async (ads: any[], userId: string | undefined) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('wizard_progress')
        .upsert({
          user_id: userId,
          generated_ads: ads,
          updated_at: new Date().toISOString(),
          version: 1
        });

      if (error) throw error;

      setSavedAds(ads);
    } catch (error) {
      console.error('[useAdPersistence] Error saving ads:', error);
      toast({
        title: "Error",
        description: "Failed to save generated ads",
        variant: "destructive",
      });
    }
  };

  const loadSavedAds = async (userId: string | undefined) => {
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('wizard_progress')
        .select('generated_ads')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      if (data?.generated_ads) {
        setSavedAds(data.generated_ads);
        return data.generated_ads;
      }

      return [];
    } catch (error) {
      console.error('[useAdPersistence] Error loading ads:', error);
      return [];
    }
  };

  return {
    savedAds,
    saveGeneratedAds,
    loadSavedAds
  };
};