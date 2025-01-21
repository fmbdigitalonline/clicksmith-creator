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
      const sessionId = localStorage.getItem('anonymous_session_id');
      const isAnonymousMode = !!sessionId;

      console.log('[useAdGeneration] Starting ad generation:', { 
        isAnonymousMode,
        sessionId,
        platform: selectedPlatform 
      });

      setGenerationStatus("Generating ads...");
      
      const requestBody = {
        type: 'complete_ads',
        platform: selectedPlatform,
        businessIdea,
        targetAudience,
        adHooks,
        isAnonymous: isAnonymousMode,
        sessionId,
        userId: null,
        numVariants: 10
      };

      let data, error;

      if (isAnonymousMode) {
        try {
          console.log('[useAdGeneration] Using direct fetch for anonymous user');
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ad-content`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify(requestBody)
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          data = await response.json();
        } catch (fetchError) {
          error = fetchError;
        }
      } else {
        console.log('[useAdGeneration] Using Supabase client for authenticated user');
        const result = await supabase.functions.invoke('generate-ad-content', {
          body: requestBody
        });
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('[useAdGeneration] Generation error:', error);
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

      console.log('[useAdGeneration] Generated variants:', data?.variants);

      if (data?.variants) {
        const variants = Array.from({ length: 10 }, (_, index) => ({
          ...data.variants[index % data.variants.length],
          id: crypto.randomUUID(),
          platform: selectedPlatform,
        }));

        setAdVariants(variants);

        if (isAnonymousMode) {
          console.log('[useAdGeneration] Updating anonymous usage with generated ads');
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/anonymous_usage`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({ 
                used: true,
                wizard_data: {
                  business_idea: businessIdea,
                  target_audience: targetAudience,
                  generated_ads: variants
                }
              })
            }
          );

          if (!response.ok) {
            console.error('[useAdGeneration] Error updating anonymous usage:', response.statusText);
            throw new Error('Failed to update anonymous usage');
          }
          
          console.log('[useAdGeneration] Anonymous usage updated successfully');
          
          toast({
            title: "Ads Generated Successfully",
            description: "Sign up now to save your progress and continue using the app!",
            variant: "default",
          });
        } else {
          // Only invalidate queries for authenticated users
          await queryClient.invalidateQueries({ queryKey: ['subscription'] });
          await queryClient.invalidateQueries({ queryKey: ['free_tier_usage'] });

          toast({
            title: "Ads Generated Successfully",
            description: `Your new ${selectedPlatform} ad variants are ready!`,
          });
        }

        return variants;
      }

    } catch (error: any) {
      console.error('[useAdGeneration] Ad generation error:', error);
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