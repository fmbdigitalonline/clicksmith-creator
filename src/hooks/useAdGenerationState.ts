import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCreditsManagement } from '@/hooks/useCreditsManagement';
import { supabase } from '@/integrations/supabase/client';

export const useAdGenerationState = (userId: string | undefined) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const { checkCredits } = useCreditsManagement();
  const { toast } = useToast();

  const generateAds = useCallback(async (platform: string) => {
    if (!userId) return [];
    
    try {
      setIsGenerating(true);
      setGenerationStatus(`Generating ${platform} ads...`);

      const hasCredits = await checkCredits(1);
      if (!hasCredits) {
        console.log('[useAdGenerationState] No credits available');
        return [];
      }

      const { data, error } = await supabase.functions.invoke('generate-ad-content', {
        body: { type: 'complete_ads', platform }
      });

      if (error) {
        console.error('[useAdGenerationState] Generation error:', error);
        throw error;
      }

      return data?.variants || [];
    } catch (error) {
      console.error('[useAdGenerationState] Error:', error);
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
  }, [userId, checkCredits, toast]);

  return {
    isGenerating,
    generationStatus,
    generateAds
  };
};