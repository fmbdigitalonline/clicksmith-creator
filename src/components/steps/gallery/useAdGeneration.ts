import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import { VideoAdVariant } from "@/types/videoAdTypes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import logger from "@/utils/logger";
import { createDataBackup } from "@/utils/dataSync";

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
    logger.info('Starting ad generation', {
      component: 'useAdGeneration',
      action: 'generateAds',
      details: { platform: selectedPlatform }
    });

    setIsGenerating(true);
    setGenerationStatus(`Initializing ${selectedPlatform} ad generation...`);
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        logger.error('User authentication error', {
          component: 'useAdGeneration',
          action: 'generateAds',
          error: userError
        });
        throw userError;
      }
      
      if (!user) {
        throw new Error('User must be logged in to generate ads');
      }

      if (projectId && projectId !== 'new') {
        await createDataBackup(user.id, {
          business_idea: businessIdea,
          target_audience: targetAudience,
          selected_hooks: adHooks,
          current_step: 4
        });
      }

      setGenerationStatus(`Generating ${selectedPlatform} ads...`);
      
      const { data, error } = await supabase.functions.invoke('generate-ad-content', {
        body: {
          type: 'complete_ads',
          platform: selectedPlatform,
          business_idea: businessIdea,
          target_audience: targetAudience,
          ad_hooks: adHooks,
          userId: user.id,
          numVariants: 10
        },
      });

      if (error) {
        logger.error('Generation error', {
          component: 'useAdGeneration',
          action: 'generateAds',
          error
        });
        
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

      if (!data?.variants || !Array.isArray(data.variants)) {
        throw new Error('Invalid response format from server');
      }

      logger.info('Generated variants successfully', {
        component: 'useAdGeneration',
        action: 'generateAds',
        details: { count: data.variants.length }
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
      logger.error('Error in ad generation', {
        component: 'useAdGeneration',
        action: 'generateAds',
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
