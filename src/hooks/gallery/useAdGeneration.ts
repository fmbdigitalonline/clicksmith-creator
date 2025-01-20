import { BusinessIdea, TargetAudience, AdHook } from "@/types/adWizard";
import { VideoAdVariant } from "@/types/videoAdTypes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { v4 as uuidv4 } from 'uuid';

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
      let sessionId = localStorage.getItem('anonymous_session_id');
      
      if (!user && !sessionId) {
        sessionId = uuidv4();
        localStorage.setItem('anonymous_session_id', sessionId);
        console.log('Created new anonymous session:', sessionId);
      }
      
      setGenerationStatus("Generating ads...");

      const functionOptions = {
        body: {
          type: 'complete_ads',
          platform: selectedPlatform,
          businessIdea,
          targetAudience,
          adHooks,
          userId: user?.id || null,
          sessionId: !user ? sessionId : null,
          numVariants: 10
        },
        headers: !user && sessionId ? {
          'x-session-id': sessionId,
          'Content-Type': 'application/json'
        } : undefined
      };

      console.log('Invoking function with options:', functionOptions);
      
      const { data, error } = await supabase.functions.invoke('generate-ad-content', functionOptions);

      if (error) {
        console.error('Generation error:', error);
        if (error.message.includes('No credits available')) {
          toast({
            title: "No credits available",
            description: "Please upgrade your plan to continue generating ads.",
            variant: "destructive",
          });
          navigate('/pricing');
          return;
        }
        
        if (error.message.includes('Anonymous trial used')) {
          toast({
            title: "Trial Expired",
            description: "Your anonymous trial has been used. Please sign up to continue.",
            variant: "destructive",
          });
          navigate('/login');
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
        // Refresh credits display for authenticated users
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['free_tier_usage'] });
      }

      toast({
        title: "Ads generated successfully",
        description: `Your new ${selectedPlatform} ad variants are ready!`,
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