import { useState, useCallback, useEffect } from 'react';
import { useToast } from './use-toast';
import { BusinessIdea, TargetAudience, AdHook } from '@/types/adWizard';
import { useAdGenerationLock } from './useAdGenerationLock';
import { supabase } from "@/integrations/supabase/client";
import { useAtomicOperation } from './useAtomicOperation';

const RETRY_DELAYS = [2000, 4000, 8000];

export const usePlatformAds = (
  businessIdea: BusinessIdea,
  targetAudience: TargetAudience,
  adHooks: AdHook[],
  platform: string
) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const { toast } = useToast();
  const { executeAtomically } = useAtomicOperation();
  const {
    isLocked,
    acquireLock,
    releaseLock,
    canRetry,
    incrementRetry,
    retryCount
  } = useAdGenerationLock();

  const generatePlatformAds = useCallback(async () => {
    if (isLocked || isGenerating) {
      console.log('[usePlatformAds] Generation already in progress');
      return [];
    }

    if (!await acquireLock()) {
      console.log('[usePlatformAds] Failed to acquire lock');
      return [];
    }

    try {
      setIsLoading(true);
      setIsGenerating(true);
      setGenerationStatus(`Generating ${platform} ads...`);

      const result = await executeAtomically(async () => {
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
      }, `generate_ads_${platform}`);

      if (!result && canRetry()) {
        const currentRetry = incrementRetry();
        const delay = RETRY_DELAYS[currentRetry - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return generatePlatformAds();
      }

      return result || [];
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
      setIsGenerating(false);
      setGenerationStatus('');
      releaseLock();
    }
  }, [platform, businessIdea, targetAudience, adHooks, isLocked, isGenerating, acquireLock, releaseLock, canRetry, incrementRetry, executeAtomically, toast]);

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