import { useState, useCallback } from 'react';
import { useToast } from './use-toast';
import { BusinessIdea, TargetAudience, AdHook } from '@/types/adWizard';
import { supabase } from '@/integrations/supabase/client';
import { useCreditsManagement } from './useCreditsManagement';

export const useAdGeneration = (
  businessIdea: BusinessIdea,
  targetAudience: TargetAudience,
  adHooks: AdHook[]
) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const { checkCredits } = useCreditsManagement();
  const { toast } = useToast();

  const generateAds = useCallback(async (platform: string) => {
    if (isGenerating) {
      console.log('[useAdGeneration] Generation already in progress');
      return [];
    }

    try {
      setIsGenerating(true);
      setGenerationStatus(`Generating ${platform} ads...`);

      const hasCredits = await checkCredits(1);
      if (!hasCredits) {
        console.log('[useAdGeneration] No credits available');
        return [];
      }

      const { data, error } = await supabase.functions.invoke('generate-ad-content', {
        body: { 
          type: 'complete_ads',
          platform,
          businessIdea,
          targetAudience,
          adHooks
        }
      });

      if (error) throw error;

      return data?.variants || [];
    } catch (error) {
      console.error('[useAdGeneration] Error:', error);
      toast({
        title: "Error generating ads",
        description: error instanceof Error ? error.message : "Failed to generate ads",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  }, [businessIdea, targetAudience, adHooks, isGenerating, checkCredits, toast]);

  return {
    isGenerating,
    generationStatus,
    generateAds
  };
};