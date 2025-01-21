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
  const [sessionId] = useState(() => localStorage.getItem('anonymous_session_id'));

  const generateAds = async (selectedPlatform: string) => {
    setIsGenerating(true);
    setGenerationStatus("Initializing generation...");
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentSessionId = localStorage.getItem('anonymous_session_id');
      
      console.log('[useAdGeneration] Generation attempt:', {
        hasUser: !!user,
        sessionId: currentSessionId,
        platform: selectedPlatform
      });

      // For anonymous users, check session
      if (!user && currentSessionId) {
        console.log('[useAdGeneration] Anonymous user detected, checking session:', currentSessionId);
        const { data: anonymousData, error: anonymousError } = await supabase
          .from('anonymous_usage')
          .select('used, completed')
          .eq('session_id', currentSessionId)
          .maybeSingle();

        if (anonymousError) {
          console.error('[useAdGeneration] Error checking anonymous session:', anonymousError);
          throw anonymousError;
        }

        console.log('[useAdGeneration] Anonymous session data:', anonymousData);

        if (anonymousData?.completed) {
          toast({
            title: "Trial Complete",
            description: "Please sign up to continue using the app.",
            variant: "destructive",
          });
          navigate('/login');
          return;
        }
      }

      setGenerationStatus("Generating ads...");
      
      const requestConfig: any = {
        body: {
          type: 'complete_ads',
          platform: selectedPlatform,
          businessIdea,
          targetAudience,
          adHooks,
          userId: user?.id,
          isAnonymous: !user,
          sessionId: currentSessionId,
          numVariants: 10
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
      if (!user && currentSessionId) {
        console.log('[useAdGeneration] Updating anonymous usage with generated ads');
        const { error: anonymousError } = await supabase
          .from('anonymous_usage')
          .update({ 
            used: true,
            wizard_data: {
              business_idea: businessIdea,
              target_audience: targetAudience,
              generated_ads: variants
            },
            completed: true
          })
          .eq('session_id', currentSessionId);

        if (anonymousError) {
          console.error('[useAdGeneration] Error updating anonymous usage:', anonymousError);
          throw anonymousError;
        }
        
        console.log('[useAdGeneration] Anonymous usage updated successfully');
        
        // Show completion message for anonymous users
        toast({
          title: "Trial Complete",
          description: "Sign up now to save your progress and continue using the app!",
          variant: "default",
        });
        
        // Short delay before redirecting to allow toast to be seen
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              from: location.pathname,
              anonymousData: {
                businessIdea,
                targetAudience,
                generatedAds: variants
              }
            }
          });
        }, 2000);
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
      
      const isAnonymous = !await supabase.auth.getUser().then(({ data }) => data.user);
      
      const errorMessage = isAnonymous
        ? "You can try generating ads as a guest. Register for unlimited generations."
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