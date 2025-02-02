import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

export const useInitialGeneration = (
  userId: string | undefined,
  isGenerating: boolean,
  isLoadingState: boolean,
  currentAds: any[],
  initialLoadDone: boolean,
  setInitialLoadDone: (done: boolean) => void,
  setIsDisplayLoading: (loading: boolean) => void,
  generateAds: (platform: string) => Promise<any[]>,
  currentPlatform: string
) => {
  const { toast } = useToast();

  useEffect(() => {
    const handleInitialGeneration = async () => {
      if (!initialLoadDone && userId && !isGenerating && !isLoadingState && currentAds.length === 0) {
        console.log('[useInitialGeneration] Starting initial ad generation');
        try {
          setIsDisplayLoading(true);
          const newAds = await generateAds(currentPlatform);
          if (newAds && newAds.length > 0) {
            console.log('[useInitialGeneration] Initial ads generated:', newAds);
            toast({
              title: "Ads Generated",
              description: `Successfully generated ${currentPlatform} ads.`,
            });
          }
        } catch (error) {
          console.error('[useInitialGeneration] Error in initial generation:', error);
          toast({
            title: "Error",
            description: "Failed to generate initial ads. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsDisplayLoading(false);
          setInitialLoadDone(true);
        }
      }
    };

    handleInitialGeneration();
  }, [userId, isGenerating, isLoadingState, currentAds.length, initialLoadDone]);
};