import { useState, useCallback } from 'react';
import { useToast } from './use-toast';

export const usePlatformState = () => {
  const [currentPlatform, setCurrentPlatform] = useState('facebook');
  const [isChangingPlatform, setIsChangingPlatform] = useState(false);
  const [pendingPlatform, setPendingPlatform] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePlatformChange = useCallback(async (newPlatform: string, hasExistingAds: boolean) => {
    console.log('[usePlatformState] Handling platform change:', { newPlatform, hasExistingAds });
    
    if (hasExistingAds) {
      setPendingPlatform(newPlatform);
      setIsChangingPlatform(true);
      return currentPlatform;
    }
    
    setCurrentPlatform(newPlatform.toLowerCase());
    toast({
      title: "Platform Changed",
      description: `Switched to ${newPlatform} ads.`,
    });
    
    return newPlatform.toLowerCase();
  }, [currentPlatform, toast]);

  const confirmPlatformChange = useCallback(() => {
    console.log('[usePlatformState] Confirming platform change to:', pendingPlatform);
    
    if (pendingPlatform) {
      setCurrentPlatform(pendingPlatform.toLowerCase());
      setIsChangingPlatform(false);
      const confirmedPlatform = pendingPlatform.toLowerCase();
      setPendingPlatform(null);
      return confirmedPlatform;
    }
    return currentPlatform.toLowerCase();
  }, [currentPlatform, pendingPlatform]);

  const cancelPlatformChange = useCallback(() => {
    console.log('[usePlatformState] Cancelling platform change');
    setPendingPlatform(null);
    setIsChangingPlatform(false);
  }, []);

  return {
    currentPlatform: currentPlatform.toLowerCase(),
    isChangingPlatform,
    setIsChangingPlatform,
    handlePlatformChange,
    confirmPlatformChange,
    cancelPlatformChange
  };
};