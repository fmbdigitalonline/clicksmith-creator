import { useState, useCallback } from "react";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";

export const useWizardProgress = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [businessIdea, setBusinessIdea] = useState<BusinessIdea | null>(null);
  const [targetAudience, setTargetAudience] = useState<TargetAudience | null>(null);
  const [audienceAnalysis, setAudienceAnalysis] = useState<AudienceAnalysis | null>(null);

  const saveProgress = async (data: WizardData) => {
    console.log('[WizardProgress] Starting to save progress:', {
      userId: data.user_id,
      step: data.current_step,
      version: data.version
    });

    try {
      const startTime = performance.now();
      const { error } = await supabase
        .from('wizard_progress')
        .upsert(data, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        });

      const duration = Math.round(performance.now() - startTime);
      
      if (error) {
        console.error('[WizardProgress] Error saving progress:', {
          error,
          duration,
          data: {
            userId: data.user_id,
            step: data.current_step
          }
        });
        throw error;
      }

      console.log('[WizardProgress] Successfully saved progress:', {
        duration,
        userId: data.user_id,
        step: data.current_step,
        version: data.version
      });
    } catch (error) {
      console.error('[WizardProgress] Unexpected error in saveProgress:', error);
      throw error;
    }
  };

  const handleBack = useCallback(() => {
    console.log('[WizardProgress] Moving back from step:', currentStep);
    setCurrentStep(prev => Math.max(1, prev - 1));
  }, [currentStep]);

  const canNavigateToStep = useCallback((step: number): boolean => {
    console.log('[WizardProgress] Checking navigation to step:', step, {
      hasBusinessIdea: !!businessIdea,
      hasTargetAudience: !!targetAudience,
      hasAudienceAnalysis: !!audienceAnalysis
    });

    switch (step) {
      case 1:
        return true;
      case 2:
        return !!businessIdea;
      case 3:
        return !!businessIdea && !!targetAudience;
      case 4:
        return !!businessIdea && !!targetAudience && !!audienceAnalysis;
      default:
        return false;
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