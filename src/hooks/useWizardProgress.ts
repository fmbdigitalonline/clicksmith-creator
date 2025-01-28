import { useState, useCallback } from "react";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { useToast } from "@/hooks/use-toast";

export const useWizardProgress = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [businessIdea, setBusinessIdea] = useState<BusinessIdea | null>(null);
  const [targetAudience, setTargetAudience] = useState<TargetAudience | null>(null);
  const [audienceAnalysis, setAudienceAnalysis] = useState<AudienceAnalysis | null>(null);
  const { toast } = useToast();

  const saveProgress = async (data: WizardData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const sessionId = localStorage.getItem('anonymous_session_id');

      if (!user && sessionId) {
        const { error: anonymousError } = await supabase
          .from('anonymous_usage')
          .upsert({
            session_id: sessionId,
            wizard_data: {
              ...data,
              updated_at: new Date().toISOString()
            },
            last_completed_step: currentStep
          }, {
            onConflict: 'session_id'
          });

        if (anonymousError) throw anonymousError;
        return;
      }

      if (user) {
        const { error } = await supabase
          .from('wizard_progress')
          .upsert(
            {
              user_id: user.id,
              ...data,
              current_step: currentStep,
              updated_at: new Date().toISOString()
            },
            {
              onConflict: 'user_id'
            }
          );

        if (error) throw error;
      }
    } catch (error) {
      console.error('[WizardProgress] Save error:', error);
      toast({
        title: "Error Saving Progress",
        description: "Your progress could not be saved. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBack = useCallback(() => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  }, []);

  const canNavigateToStep = useCallback((step: number): boolean => {
    switch (step) {
      case 1: return true;
      case 2: return !!businessIdea;
      case 3: return !!businessIdea && !!targetAudience;
      case 4: return !!businessIdea && !!targetAudience && !!audienceAnalysis;
      default: return false;
    }
  }, [businessIdea, targetAudience, audienceAnalysis]);

  return {
    currentStep,
    setCurrentStep,
    businessIdea,
    setBusinessIdea,
    targetAudience,
    setTargetAudience,
    audienceAnalysis,
    setAudienceAnalysis,
    handleBack,
    canNavigateToStep,
    saveProgress
  };
};