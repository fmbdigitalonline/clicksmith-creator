import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";

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
  const [sessionId] = useState(() => localStorage.getItem('anonymous_session_id') || crypto.randomUUID());

  // Ensure session ID is saved
  useEffect(() => {
    if (!localStorage.getItem('anonymous_session_id')) {
      localStorage.setItem('anonymous_session_id', sessionId);
    }
  }, [sessionId]);

  const generateAds = async (selectedPlatform: string) => {
    setIsGenerating(true);
    setGenerationStatus("Initializing generation...");
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const sessionId = localStorage.getItem('anonymous_session_id');
      
      // Check for either authenticated user or valid anonymous session
      if (!user && !sessionId) {
        throw new Error('No valid user session found');
      }

      console.log('Generating ads with session:', { 
        userId: user?.id, 
        sessionId, 
        isAnonymous: !user 
      });

      setGenerationStatus("Generating ads...");
      
      const { data, error } = await supabase.functions.invoke('generate-ad-content', {
        body: {
          type: 'complete_ads',
          platform: selectedPlatform,
          businessIdea,
          targetAudience,
          adHooks,
          userId: user?.id || sessionId, // Use sessionId for anonymous users
          isAnonymous: !user,  // Add flag to indicate anonymous status
          numVariants: 10
        },
        headers: !user ? {
          'x-session-id': sessionId
        } : undefined
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
        }
      } else {
        // For anonymous users, update anonymous_usage
        try {
          await supabase
            .from('anonymous_usage')
            .upsert({ 
              session_id: sessionId,
              used: true,
              wizard_data: {
                business_idea: businessIdea,
                target_audience: targetAudience,
                generated_ads: variants
              }
            }, {
              onConflict: 'session_id'
            });
        } catch (anonymousError) {
          console.error('Error updating anonymous usage:', anonymousError);
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