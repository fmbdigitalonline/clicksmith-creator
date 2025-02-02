import { useState, useEffect } from 'react';
import { toast } from "@/hooks/use-toast";
import { useAdGeneration } from '@/hooks/useAdGeneration';
import { BusinessIdea, TargetAudience, AdHook } from '@/types/adWizard';

interface AdGenerationHandlerProps {
  userId: string | undefined;
  currentPlatform: string;
  setIsDisplayLoading: (loading: boolean) => void;
  setCurrentAds: (ads: any[]) => void;
  saveGeneratedAds: (ads: any[]) => void;
  businessIdea: BusinessIdea;
  targetAudience: TargetAudience;
  adHooks: AdHook[];
}

export const useAdGenerationHandler = ({
  userId,
  currentPlatform,
  setIsDisplayLoading,
  setCurrentAds,
  saveGeneratedAds,
  businessIdea,
  targetAudience,
  adHooks
}: AdGenerationHandlerProps) => {
  const [initialGenerationDone, setInitialGenerationDone] = useState(false);
  
  const {
    isGenerating,
    generationStatus,
    generateAds
  } = useAdGeneration(businessIdea, targetAudience, adHooks);

  const handleGeneration = async (platform: string) => {
    try {
      setIsDisplayLoading(true);
      console.log(`[AdGenerationHandler] Generating ads for platform: ${platform}`);
      
      const newAds = await generateAds(platform);
      console.log('[AdGenerationHandler] Generated ads:', newAds);
      
      if (newAds && newAds.length > 0) {
        await saveGeneratedAds(newAds);
        setCurrentAds(newAds);
        toast({
          title: "Ads Generated",
          description: `Successfully generated ${platform} ads.`,
        });
        return true;
      } else {
        console.error('[AdGenerationHandler] No ads generated');
        toast({
          title: "Error",
          description: "No ads were generated. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error('[AdGenerationHandler] Error generating ads:', error);
      toast({
        title: "Error",
        description: "Failed to generate ads. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsDisplayLoading(false);
    }
  };

  const handleInitialGeneration = async () => {
    if (!initialGenerationDone) {
      console.log('[AdGenerationHandler] Starting initial generation');
      const success = await handleGeneration(currentPlatform);
      if (success) {
        setInitialGenerationDone(true);
      }
    }
  };

  return {
    handleGeneration,
    handleInitialGeneration,
    isGenerating,
    generationStatus,
    initialGenerationDone
  };
};