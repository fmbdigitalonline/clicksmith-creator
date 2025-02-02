import { toast } from "@/hooks/use-toast";

interface PlatformChangeHandlerProps {
  handleGeneration: (platform: string) => Promise<boolean>;
  confirmPlatformChange: () => string;
  cancelPlatformChange: () => void;
}

export const usePlatformChangeHandler = ({
  handleGeneration,
  confirmPlatformChange,
  cancelPlatformChange
}: PlatformChangeHandlerProps) => {
  
  const handlePlatformChange = async () => {
    try {
      const confirmedPlatform = confirmPlatformChange();
      console.log('[PlatformChangeHandler] Confirmed platform change:', confirmedPlatform);
      
      const success = await handleGeneration(confirmedPlatform);
      if (!success) {
        throw new Error('Failed to generate ads for new platform');
      }
    } catch (error) {
      console.error('[PlatformChangeHandler] Error:', error);
      cancelPlatformChange();
      toast({
        title: "Error",
        description: "Failed to change platform. Please try again.",
        variant: "destructive",
      });
    }
  };

  return { handlePlatformChange };
};