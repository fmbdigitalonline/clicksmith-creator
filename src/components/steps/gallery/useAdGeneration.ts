import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import { VideoAdVariant } from "@/types/videoAdTypes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
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
  const { projectId } = useParams();
  const queryClient = useQueryClient();

  const generateAds = async (selectedPlatform: string) => {
    const startTime = performance.now();
    logger.info("Starting ad generation", { 
      component: "AdGeneration",
      details: { platform: selectedPlatform, projectId }
    });
    
    setIsGenerating(true);
    setGenerationStatus(`Initializing ${selectedPlatform} ad generation...`);
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        logger.error("User authentication error", {
          component: "AdGeneration",
          error: userError
        });
        throw userError;
      }
      
      if (!user) {
        logger.error("No authenticated user found", { component: "AdGeneration" });
        throw new Error('User must be logged in to generate ads');
      }

      logger.info("Generating ads", {
        component: "AdGeneration",
        details: { userId: user.id, platform: selectedPlatform }
      });
      
      const { data, error } = await supabase.functions.invoke('generate-ad-content', {
        body: {
          type: 'complete_ads',
          platform: selectedPlatform,
          businessIdea,
          targetAudience,
          adHooks,
          userId: user.id,
          numVariants: 10
        },
      });

      if (error) {
        logger.error("Error generating ads", error);
        if (error.message.includes('No credits available')) {
          toast({
            title: "No credits available",
            description: "Please upgrade your plan to continue generating ads.",
            variant: "destructive",
          });
          navigate('/pricing');
          return false;
        }
        throw error;
      }

      const endTime = performance.now();
      logger.info("Generation completed", {
        component: "AdGeneration",
        duration: endTime - startTime,
        variantsCount: data?.variants?.length
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
      logger.error("Ad generation failed", {
        component: "AdGeneration",
        error
      });
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
