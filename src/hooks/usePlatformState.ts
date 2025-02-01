import { useState, useCallback } from 'react';
import { useToast } from './use-toast';

export const usePlatformState = () => {
  const [currentPlatform, setCurrentPlatform] = useState('facebook');
  const [isChangingPlatform, setIsChangingPlatform] = useState(false);
  const { toast } = useToast();

  const handlePlatformChange = useCallback(async (newPlatform: string, hasExistingAds: boolean) => {
    if (hasExistingAds) {
      setIsChangingPlatform(true);
      return;
    }
    
    setCurrentPlatform(newPlatform);
    toast({
      title: "Platform Changed",
      description: `Switched to ${newPlatform} ads.`,
    });
  }, [toast]);

  const confirmPlatformChange = useCallback(() => {
    setIsChangingPlatform(false);
    setCurrentPlatform(prev => prev);
    return currentPlatform;
  }, [currentPlatform]);

  const cancelPlatformChange = useCallback(() => {
    setIsChangingPlatform(false);
  }, []);

  return {
    currentPlatform,
    isChangingPlatform,
    handlePlatformChange,
    confirmPlatformChange,
    cancelPlatformChange
  };
};