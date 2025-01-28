import { useState, useCallback } from "react";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { supabase } from "@/integrations/supabase/client";
import { WizardData, WizardHook } from "@/types/wizardProgress";

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
      
      // Convert WizardHook[] to a JSON-compatible format
      const jsonCompatibleHooks = data.selected_hooks?.map(hook => ({
        imageUrl: hook.imageUrl,
        description: hook.description,
        text: hook.text
      }));
      
      // Prepare the data object to match the database schema exactly
      const progressData = {
        user_id: data.user_id,
        business_idea: data.business_idea || null,
        target_audience: data.target_audience || null,
        audience_analysis: data.audience_analysis || null,
        selected_hooks: jsonCompatibleHooks || null,
        generated_ads: data.generated_ads || null,
        current_step: data.current_step || 1,
        version: data.version || 1,
        is_migration: data.is_migration || false,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('wizard_progress')
        .upsert(progressData, { 
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