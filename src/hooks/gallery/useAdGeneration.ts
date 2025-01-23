import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import { VideoAdVariant } from "@/types/videoAdTypes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";

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
    console.log('[useAdGeneration] Starting ad generation for platform:', selectedPlatform);
    setIsGenerating(true);
    setGenerationStatus(`Initializing ${selectedPlatform} ad generation...`);
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('[useAdGeneration] User error:', userError);
        throw userError;
      }
      
      if (!user) {
        throw new Error('User must be logged in to generate ads');
      }

      setGenerationStatus(`Generating ${selectedPlatform} ads...`);
      
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
        console.error('[useAdGeneration] Generation error:', error);
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

      console.log(`[useAdGeneration] Generated ${selectedPlatform} variants:`, data.variants);

      // Ensure we have exactly 10 variants with the correct platform and format
      const variants = data.variants.map(variant => ({
        ...variant,
        platform: selectedPlatform,
        id: variant.id || crypto.randomUUID(),
      }));

      setAdVariants(variants);

      // Refresh credits display
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['free_tier_usage'] });

      toast({
        title: "Ads generated successfully",
        description: `Your new ${selectedPlatform} ad variants are ready!`,
      });

      return true;
    } catch (error: any) {
      console.error('[useAdGeneration] Error:', error);
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