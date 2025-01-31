import { useState, useEffect, useCallback } from 'react';
import { useAdGeneration } from './gallery/useAdGeneration';
import { useToast } from './use-toast';
import { BusinessIdea, TargetAudience, AdHook } from '@/types/adWizard';
import { useAdGenerationLock } from './useAdGenerationLock';

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

  const {
    isLocked,
    acquireLock,
    releaseLock,
    canRetry,
    incrementRetry
  } = useAdGenerationLock();

  const generatePlatformAds = useCallback(async () => {
    if (isLocked) {
      console.log('[usePlatformAds] Generation already in progress');
      return [];
    }

    if (!acquireLock()) {
      console.log('[usePlatformAds] Failed to acquire lock');
      return [];
    }

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
      
      if (canRetry()) {
        const retryCount = incrementRetry();
        console.log(`[usePlatformAds] Retrying generation (${retryCount}/3)`);
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return generatePlatformAds();
      }

      toast({
        title: "Error",
        description: "Failed to generate ads. Please try again.",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
      releaseLock();
    }
  }, [platform, generateAds, isLocked, acquireLock, releaseLock, canRetry, incrementRetry, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseLock();
    };
  }, [releaseLock]);

  return {
    isLoading,
    isGenerating,
    generationStatus,
    generatePlatformAds,
  };
};