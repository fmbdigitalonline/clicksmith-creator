import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAtomicOperation } from './useAtomicOperation';
import { AdVariant, convertAdVariantToJson } from '@/types/adVariant';

export const useAdPersistence = (projectId: string | undefined) => {
  const [savedAds, setSavedAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { executeAtomically, isProcessing } = useAtomicOperation();
  const { toast } = useToast();

  const loadSavedAds = async () => {
    if (!projectId || projectId === 'new') return;
    
    setIsLoading(true);
    try {
      const result = await executeAtomically(async () => {
        const { data: project } = await supabase
          .from('projects')
          .select('generated_ads')
          .eq('id', projectId)
          .maybeSingle();
        
        if (project?.generated_ads && Array.isArray(project.generated_ads)) {
          setSavedAds(project.generated_ads);
          return project.generated_ads;
        }
        return [];
      }, `load_ads_${projectId}`);

      if (result) {
        console.log('[AdPersistence] Successfully loaded ads:', result.length);
      }
    } catch (error) {
      console.error('[AdPersistence] Error loading saved ads:', error);
      toast({
        title: "Error loading ads",
        description: "Failed to load saved ads. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveGeneratedAds = async (newAds: AdVariant[]) => {
    if (!projectId || projectId === 'new' || isProcessing) return;

    const result = await executeAtomically(async () => {
      const jsonAds = newAds.map(convertAdVariantToJson);
      
      // Merge new ads with existing ones, avoiding duplicates
      const updatedAds = [...savedAds, ...jsonAds].filter((ad, index, self) => 
        index === self.findIndex((t) => t.id === ad.id)
      );

      const { error: updateError } = await supabase
        .from('projects')
        .update({ generated_ads: updatedAds })
        .eq('id', projectId);

      if (updateError) throw updateError;
      setSavedAds(updatedAds);
      return updatedAds;
    }, `save_ads_${projectId}`);

    if (result) {
      console.log('[AdPersistence] Successfully saved ads:', result.length);
      toast({
        title: "Success",
        description: "Ads saved successfully",
      });
    }
  };

  return {
    savedAds,
    isLoading: isLoading || isProcessing,
    saveGeneratedAds
  };
};