import { useState, useEffect } from 'react';
import { useAdGeneration } from './gallery/useAdGeneration';
import { useToast } from './use-toast';
import { BusinessIdea, TargetAudience, AdHook } from '@/types/adWizard';

export const usePlatformAds = (
  businessIdea: BusinessIdea,
  targetAudience: TargetAudience,
  adHooks: AdHook[],
  platform: string
) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const {
    isGenerating,
    generationStatus,
    generateAds,
  } = useAdGeneration(businessIdea, targetAudience, adHooks);

  const generatePlatformAds = async () => {
    try {
      setIsLoading(true);
      console.log(`[usePlatformAds] Generating ads for platform: ${platform}`);
      const newAds = await generateAds(platform);
      
      if (!newAds || !Array.isArray(newAds)) {
        throw new Error('Failed to generate ads');
      }

      return newAds;
    } catch (error) {
      console.error(`[usePlatformAds] Error generating ${platform} ads:`, error);
      toast({
        title: "Error",
        description: "Failed to generate ads. Please try again.",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    isGenerating,
    generationStatus,
    generatePlatformAds,
  };
};