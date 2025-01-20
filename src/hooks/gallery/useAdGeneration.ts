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
      
      setGenerationStatus("Generating ads...");
      
      const { data, error } = await supabase.functions.invoke('generate-ad-content', {
        body: {
          type: 'complete_ads',
          platform: selectedPlatform,
          businessIdea,
          targetAudience,
          adHooks,
          userId: user?.id || null,
          numVariants: 10
        },
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

      console.log('Generated variants:', data.variants);

      // Ensure we have exactly 10 variants
      const variants = Array.from({ length: 10 }, (_, index) => ({
        ...data.variants[index % data.variants.length],
        id: crypto.randomUUID(),
        platform: selectedPlatform,
      }));

      setAdVariants(variants);

      // Only refresh credits for logged-in users
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['free_tier_usage'] });
      }

      // Mark anonymous session as used
      if (!user) {
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          await supabase
            .from('anonymous_usage')
            .update({ used: true })
            .eq('session_id', sessionId);
        }
      }

      toast({
        title: "Ads generated successfully",
        description: `Your new ${selectedPlatform} ad variants are ready!`,
      });
    } catch (error: any) {
      console.error('Ad generation error:', error);
      
      const { data: { user } } = await supabase.auth.getUser();
      // More specific error message for anonymous users
      const errorMessage = !user 
        ? "Failed to generate ads. Please try again or register for more features."
        : error.message || "Failed to generate ads. Please try again.";
      
      toast({
        title: "Error generating ads",
        description: errorMessage,
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