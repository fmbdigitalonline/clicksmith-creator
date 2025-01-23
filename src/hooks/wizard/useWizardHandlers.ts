import { useCallback } from "react";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { saveWizardProgress, clearWizardProgress } from "@/utils/wizardProgress";

export const useWizardHandlers = (
  setBusinessIdea: (idea: BusinessIdea) => void,
  setTargetAudience: (audience: TargetAudience) => void,
  setAudienceAnalysis: (analysis: AudienceAnalysis) => void,
  setCurrentStep: (step: number) => void,
  projectId?: string
) => {
  const { toast } = useToast();

  const handleIdeaSubmit = useCallback(async (idea: BusinessIdea) => {
    setBusinessIdea(idea);
    await saveWizardProgress({ business_idea: idea }, projectId);
    setCurrentStep(2);
  }, [projectId, setBusinessIdea, setCurrentStep]);

  const handleAudienceSelect = useCallback(async (audience: TargetAudience) => {
    setTargetAudience(audience);
    await saveWizardProgress({ target_audience: audience }, projectId);
    setCurrentStep(3);
  }, [projectId, setTargetAudience, setCurrentStep]);

  const handleAnalysisComplete = useCallback(async (analysis: AudienceAnalysis) => {
    setAudienceAnalysis(analysis);
    await saveWizardProgress({ audience_analysis: analysis }, projectId);
    setCurrentStep(4);
  }, [projectId, setAudienceAnalysis, setCurrentStep]);

  const handleStartOver = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const success = await clearWizardProgress(projectId, user.id);
      
      if (success) {
        setBusinessIdea(null);
        setTargetAudience(null);
        setAudienceAnalysis(null);
        setCurrentStep(1);

        toast({
          title: "Progress Reset",
          description: "Your progress has been cleared successfully.",
        });
      }
    } catch (error) {
      console.error('Error in handleStartOver:', error);
      toast({
        title: "Error",
        description: "Failed to clear progress",
        variant: "destructive",
      });
    }
  }, [projectId, toast, setBusinessIdea, setTargetAudience, setAudienceAnalysis, setCurrentStep]);

  return {
    handleIdeaSubmit,
    handleAudienceSelect,
    handleAnalysisComplete,
    handleStartOver
  };
};