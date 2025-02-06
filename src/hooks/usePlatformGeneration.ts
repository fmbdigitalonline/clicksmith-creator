import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { BusinessIdea, TargetAudience, AdHook } from '@/types/adWizard';
import { useAdGeneration } from './useAdGeneration';

export const usePlatformGeneration = (
  businessIdea: BusinessIdea,
  targetAudience: TargetAudience,
  adHooks: AdHook[],
  saveGeneratedAds: (ads: any[]) => Promise<void>,
  setCurrentAds: (ads: any[]) => void
) => {
  const [isDisplayLoading, setIsDisplayLoading] = useState(false);
  const { toast } = useToast();
  const { generateAds, isGenerating, generationStatus } = useAdGeneration(
    businessIdea,
    targetAudience,
    adHooks
  );

  const handleGenerateAdsForPlatform = async (platform: string) => {
    try {
      setIsDisplayLoading(true);
      const newAds = await generateAds(platform);
      if (newAds && newAds.length > 0) {
        const platformAds = newAds.map(ad => ({
          ...ad,
          platform: platform.toLowerCase(),
          id: ad.id || crypto.randomUUID()
        }));
        console.log(`[usePlatformGeneration] Generated ${platform} ads:`, platformAds);
        await saveGeneratedAds(platformAds);
        setCurrentAds(platformAds);
        toast({
          title: "Ads Generated",
          description: `Successfully generated ${platform} ads.`,
        });
        return platformAds;
      }
      return [];
    } catch (error) {
      console.error('[usePlatformGeneration] Error generating ads:', error);
      toast({
        title: "Error",
        description: "Failed to generate ads. Please try again.",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsDisplayLoading(false);
    }
  };

  return {
    handleGenerateAdsForPlatform,
    isDisplayLoading,
    setIsDisplayLoading,
    isGenerating,
    generationStatus
  };
};