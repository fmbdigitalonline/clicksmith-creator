import { useState, useCallback } from 'react';
import { BusinessIdea, TargetAudience, AudienceAnalysis } from '@/types/adWizard';
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from '../auth/useAuthStore';
import { WizardData } from '@/types/wizardProgress';

export const useWizardLogic = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [businessIdea, setBusinessIdea] = useState<BusinessIdea | null>(null);
  const [targetAudience, setTargetAudience] = useState<TargetAudience | null>(null);
  const [audienceAnalysis, setAudienceAnalysis] = useState<AudienceAnalysis | null>(null);
  const { user } = useAuthStore();

  const saveProgress = useCallback(async (data: Partial<WizardData>) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('wizard_progress')
        .upsert({
          user_id: user.id,
          ...data,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('[WizardLogic] Error saving progress:', error);
    }
  }, [user]);

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
    saveProgress,
    canNavigateToStep
  };
};