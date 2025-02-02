import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";

export const usePlatformChange = (
  displayAds: any[],
  setIsDisplayLoading: (loading: boolean) => void,
  generateAds: (platform: string) => Promise<any[]>
) => {
  const [currentPlatform, setCurrentPlatform] = useState('facebook');
  const { toast } = useToast();

  const handlePlatformTabChange = async (value: string) => {
    console.log('[usePlatformChange] Platform tab change requested:', value);
    const platformAds = displayAds.filter(ad => 
      ad.platform?.toLowerCase() === value.toLowerCase()
    );
    
    const hasExistingAds = platformAds.length > 0;
    console.log('[usePlatformChange] Existing ads for platform:', value, platformAds);
    
    if (!hasExistingAds) {
      try {
        setIsDisplayLoading(true);
        console.log('[usePlatformChange] Generating new ads for platform:', value);
        await generateAds(value);
      } catch (error) {
        console.error('[usePlatformChange] Error generating ads:', error);
        toast({
          title: "Error",
          description: "Failed to generate ads. Please try again.",
          variant: "destructive",
        });
      }
    }
    
    setCurrentPlatform(value);
  };

  return {
    currentPlatform,
    handlePlatformTabChange
  };
};