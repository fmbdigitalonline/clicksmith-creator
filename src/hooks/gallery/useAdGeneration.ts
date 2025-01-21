import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
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
  const [videoVariants, setVideoVariants] = useState<any[]>([]);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const queryClient = useQueryClient();

  const generateAds = async (selectedPlatform: string) => {
    setIsGenerating(true);
    setGenerationStatus("Initializing generation...");
    
    try {
      // 1. Check for anonymous session first
      const sessionId = localStorage.getItem('anonymous_session_id');
      const isAnonymousMode = !!sessionId;
      let user = null;

      console.log('[useAdGeneration] Starting ad generation:', { 
        isAnonymousMode,
        sessionId,
        platform: selectedPlatform 
      });

      // 2. Only perform auth check if not in anonymous mode
      if (!isAnonymousMode) {
        const authResponse = await supabase.auth.getSession();
        user = authResponse.data?.session?.user || null;
      }

      setGenerationStatus("Generating ads...");
      
      // 3. Update request config to include anonymous mode info
      const requestConfig = {
        body: {
          type: 'complete_ads',
          platform: selectedPlatform,
          businessIdea,
          targetAudience,
          adHooks,
          isAnonymous: isAnonymousMode,
          sessionId: isAnonymousMode ? sessionId : null,
          userId: user?.id || null
        }
      };

      console.log('[useAdGeneration] Sending request with config:', requestConfig);

      const { data, error } = await supabase.functions.invoke('generate-ad-content', requestConfig);

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

      console.log('[useAdGeneration] Generated variants:', data.variants);

      // Ensure we have exactly 10 variants
      const variants = Array.from({ length: 10 }, (_, index) => ({
        ...data.variants[index % data.variants.length],
        id: crypto.randomUUID(),
        platform: selectedPlatform,
      }));

      setAdVariants(variants);

      // Update anonymous usage if this is an anonymous session
      if (isAnonymousMode) {
        console.log('[useAdGeneration] Updating anonymous usage with generated ads');
        const { error: anonymousError } = await supabase
          .from('anonymous_usage')
          .update({ 
            used: true,
            wizard_data: {
              business_idea: businessIdea,
              target_audience: targetAudience,
              generated_ads: variants
            }
          })
          .eq('session_id', sessionId);

        if (anonymousError) {
          console.error('[useAdGeneration] Error updating anonymous usage:', anonymousError);
          throw anonymousError;
        }
        
        console.log('[useAdGeneration] Anonymous usage updated successfully');
        
        toast({
          title: "Ads Generated Successfully",
          description: "Sign up now to save your progress and continue using the app!",
          variant: "default",
        });
      } else if (user) {
        // Handle authenticated user updates
        if (projectId && projectId !== 'new') {
          await supabase
            .from('projects')
            .update({ generated_ads: variants })
            .eq('id', projectId);
        } else {
          await supabase
            .from('wizard_progress')
            .upsert({
              user_id: user.id,
              generated_ads: variants
            }, {
              onConflict: 'user_id'
            });
        }
        
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['free_tier_usage'] });
        
        toast({
          title: "Ads Generated Successfully",
          description: `Your new ${selectedPlatform} ad variants are ready!`,
        });
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