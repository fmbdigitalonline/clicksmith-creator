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
    setIsGenerating(true);
    setGenerationStatus("Initializing generation...");
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      if (!user) {
        throw new Error('User must be logged in to generate ads');
      }

      setGenerationStatus("Generating ads...");
      
      console.log('[useAdGeneration] Preparing to invoke generate-ad-content with params:', {
        type: 'complete_ads',
        platform: selectedPlatform,
        businessIdea,
        targetAudience,
        adHooksCount: adHooks?.length,
        userId: user?.id,
        timestamp: new Date().toISOString()
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

      console.log('[useAdGeneration] Response from generate-ad-content:', {
        success: !error,
        hasData: !!data,
        error: error?.message,
        variantsCount: data?.variants?.length,
        timestamp: new Date().toISOString()
      });

      if (error) {
        if (error.message.includes('No credits available')) {
          toast({
            title: "No credits available",
            description: "Please upgrade your plan to continue generating ads.",
            variant: "destructive",
          });
          navigate('/pricing');
          return;
        }
        throw error;
      }

      console.log('[useAdGeneration] Processing variants:', {
        receivedCount: data.variants.length,
        firstVariant: data.variants[0]?.id,
        platform: selectedPlatform
      });

      // Ensure we have exactly 10 variants
      const variants = Array.from({ length: 10 }, (_, index) => ({
        ...data.variants[index % data.variants.length],
        id: crypto.randomUUID(), // Ensure unique IDs
        platform: selectedPlatform,
      }));

      setAdVariants(variants);

      // Refresh credits display
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['free_tier_usage'] });

      toast({
        title: "Ads generated successfully",
        description: `Your new ${selectedPlatform} ad variants are ready!`,
      });
    } catch (error: any) {
      console.error('[useAdGeneration] Error during ad generation:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      toast({
        title: "Error generating ads",
        description: error.message || "Failed to generate ads. Please try again.",
        variant: "destructive",
      });
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