import { useState, useCallback } from 'react';
import { useToast } from './use-toast';
import { BusinessIdea, TargetAudience, AdHook } from '@/types/adWizard';
import { useAdGenerationLock } from './useAdGenerationLock';

const RETRY_DELAYS = [2000, 4000, 8000];

export const usePlatformAds = (
  businessIdea: BusinessIdea,
  targetAudience: TargetAudience,
  adHooks: AdHook[],
  platform: string
) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const {
    isLocked,
    acquireLock,
    releaseLock,
    canRetry,
    incrementRetry,
    retryCount
  } = useAdGenerationLock();

  const generatePlatformAds = useCallback(async () => {
    if (isLocked) {
      console.log('[usePlatformAds] Generation already in progress');
      return [];
    }

    if (!await acquireLock()) {
      console.log('[usePlatformAds] Failed to acquire lock');
      return [];
    }

    try {
      setIsLoading(true);
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
      console.error(`[usePlatformAds] Error generating ${platform} ads:`, error);
      
      if (canRetry()) {
        const currentRetry = incrementRetry();
        const delay = RETRY_DELAYS[currentRetry - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        
        await new Promise(resolve => setTimeout(resolve, delay));
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
  }, [platform, businessIdea, targetAudience, adHooks, isLocked, acquireLock, releaseLock, canRetry, incrementRetry, toast]);

  useEffect(() => {
    return () => {
      releaseLock();
    };
  }, [releaseLock]);

  return {
    isLoading,
    generatePlatformAds,
  };
};