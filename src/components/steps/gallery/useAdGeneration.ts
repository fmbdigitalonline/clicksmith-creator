import { useState } from "react";
import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import { VideoAdVariant } from "@/types/videoAdTypes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import logger from "@/utils/logger";

export const useAdGeneration = (
  businessIdea: BusinessIdea,
  targetAudience: TargetAudience,
  adHooks: AdHook[]
) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [adVariants, setAdVariants] = useState<any[]>([]);
  const [videoVariants, setVideoVariants] = useState<VideoAdVariant[]>([]);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const generateAds = async (selectedPlatform: string) => {
    logger.info('[useAdGeneration](generateAds) Starting ad generation', {
      platform: selectedPlatform
    });

    setIsGenerating(true);
    setGenerationStatus(`Initializing ${selectedPlatform} ad generation...`);
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        logger.error('[useAdGeneration](generateAds) User error:', userError);
        throw userError;
      }

      setGenerationStatus(`Generating ${selectedPlatform} ads...`);
      
      const { data, error } = await supabase.functions.invoke('generate-ad-content', {
        body: {
          type: 'complete_ads',
          platform: selectedPlatform,
          business_idea: businessIdea,
          target_audience: targetAudience,
          selected_hooks: adHooks,
          userId: user?.id,
          sessionId: localStorage.getItem('anonymous_session_id'),
          isAnonymous: !user,
          numVariants: 10
        },
      });

      if (error) {
        logger.error('[useAdGeneration](generateAds) Generation error:', error);
        
        if (error.message?.includes('No credits available')) {
          toast({
            title: "No credits available",
            description: "Please upgrade your plan to continue generating ads.",
            variant: "destructive",
          });
          navigate('/pricing');
          return false;
        }

        // Add retry logic for generation errors
        throw error;
      }

      if (!data?.variants || !Array.isArray(data.variants)) {
        throw new Error('Invalid response format from server');
      }

      logger.info('[useAdGeneration](generateAds) Generated variants:', {
        count: data.variants.length
      });

      const variants = data.variants.map(variant => ({
        ...variant,
        platform: selectedPlatform,
        id: variant.id || crypto.randomUUID(),
      }));

      setAdVariants(variants);

      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['free_tier_usage'] });

      toast({
        title: "Ads generated successfully",
        description: `Your new ${selectedPlatform} ad variants are ready!`,
      });

      return true;
    } catch (error: any) {
      logger.error('[useAdGeneration](generateAds) Error in ad generation:', error);
      
      toast({
        title: "Error generating ads",
        description: error.message || "Failed to generate ads. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsGenerating(false);
      setGenerationStatus("");
    }
  };

  return {
    isGenerating,
    adVariants,
    videoVariants,
    generationStatus,
    generateAds,
  };
};