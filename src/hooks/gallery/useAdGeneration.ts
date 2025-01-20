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
      const { data: { user } } = await supabase.auth.getUser();
      
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

        // Save progress for authenticated users
        try {
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
        } catch (saveError) {
          console.error('Error saving progress:', saveError);
          // Don't show error toast for save failures
        }
      } else {
        // For anonymous users, store in local storage
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          try {
            await supabase
              .from('anonymous_usage')
              .update({ 
                used: true,
                wizard_data: {
                  ...businessIdea,
                  ...targetAudience,
                  generated_ads: variants
                }
              })
              .eq('session_id', sessionId);
          } catch (anonymousError) {
            console.error('Error updating anonymous usage:', anonymousError);
          }
        }
      }

      toast({
        title: "Ads generated successfully",
        description: user 
          ? `Your new ${selectedPlatform} ad variants are ready!`
          : `Your ${selectedPlatform} ad variants are ready! Register to save them.`,
      });
    } catch (error: any) {
      console.error('Ad generation error:', error);
      
      const isAnonymous = !await supabase.auth.getUser().then(({ data }) => data.user);
      
      // More specific error message for anonymous users
      const errorMessage = isAnonymous
        ? "You can try one more time as a guest, or register for unlimited generations."
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