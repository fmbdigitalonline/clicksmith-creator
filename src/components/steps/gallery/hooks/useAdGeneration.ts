import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { BusinessIdea, TargetAudience, AdHook } from '@/types/adWizard';
import { supabase } from '@/integrations/supabase/client';

export const useAdGeneration = (
  businessIdea: BusinessIdea,
  targetAudience: TargetAudience,
  adHooks: AdHook[]
) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const { toast } = useToast();

  const generateAds = useCallback(async (platform: string) => {
    if (!businessIdea || !targetAudience) {
      console.error('[useAdGeneration] Missing required data:', { businessIdea, targetAudience });
      toast({
        title: "Error",
        description: "Business idea and target audience are required",
        variant: "destructive",
      });
      return [];
    }

    try {
      setIsGenerating(true);
      setGenerationStatus(`Generating ${platform} ads...`);
      console.log('[useAdGeneration] Starting generation with:', { businessIdea, targetAudience, platform });

      const { data, error } = await supabase.functions.invoke('generate-ad-content', {
        body: {
          type: 'complete_ads',
          platform,
          businessIdea,
          targetAudience,
          adHooks,
          numVariants: 10
        }
      });

      if (error) {
        console.error('[useAdGeneration] Generation error:', error);
        throw error;
      }

      if (!data?.variants || !Array.isArray(data.variants)) {
        console.error('[useAdGeneration] Invalid response format:', data);
        throw new Error('Invalid response format from server');
      }

      console.log(`[useAdGeneration] Generated ${platform} variants:`, data.variants);

      const processedVariants = data.variants.map(variant => ({
        ...variant,
        platform: platform.toLowerCase(),
        id: variant.id || crypto.randomUUID(),
        headline: variant.headline || variant.hook?.text || 'Untitled Ad',
        description: variant.description || variant.primaryText || '',
        imageUrl: variant.imageUrl || variant.image?.url || '',
      }));

      return processedVariants;
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
  }, [businessIdea, targetAudience, adHooks, toast]);

  return {
    isGenerating,
    generationStatus,
    generateAds
  };
};