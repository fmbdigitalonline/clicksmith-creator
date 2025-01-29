import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

interface GeneratedAd {
  id: string;
  platform: string;
  headline: string;
  description: string;
  imageUrl: string;
  size?: {
    width: number;
    height: number;
    label: string;
  };
}

export const useAdPersistence = () => {
  const [savedAds, setSavedAds] = useState<GeneratedAd[]>([]);
  const { toast } = useToast();

  const saveGeneratedAds = async (ads: GeneratedAd[], userId: string) => {
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

  const loadSavedAds = async (userId: string): Promise<GeneratedAd[]> => {
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('wizard_progress')
        .select('generated_ads')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const adsArray = Array.isArray(data?.generated_ads) ? data.generated_ads as GeneratedAd[] : [];
      setSavedAds(adsArray);
      return adsArray;

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