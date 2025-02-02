import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from '@/types/adWizard';

export const useWizardOptimization = (
  currentStep: number,
  businessIdea: BusinessIdea | null,
  targetAudience: TargetAudience | null,
  audienceAnalysis: AudienceAnalysis | null
) => {
  // Memoize the validation logic
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return businessIdea?.description && businessIdea?.industry;
      case 2:
        return targetAudience?.name && targetAudience?.painPoints;
      case 3:
        return audienceAnalysis?.marketDesire && audienceAnalysis?.deepPainPoints;
      default:
        return false;
    }
  }, [currentStep, businessIdea, targetAudience, audienceAnalysis]);

  // Optimized progress fetching
  const { data: wizardProgress, isLoading: isLoadingProgress } = useQuery({
    queryKey: ['wizard-progress'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('wizard_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: 30000, // Cache for 30 seconds
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Memoized save function
  const saveProgress = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const progressData = {
      user_id: user.id,
      business_idea: businessIdea,
      target_audience: targetAudience,
      audience_analysis: audienceAnalysis,
      current_step: currentStep,
      updated_at: new Date().toISOString()
    };

    await supabase
      .from('wizard_progress')
      .upsert(progressData);
  }, [businessIdea, targetAudience, audienceAnalysis, currentStep]);

  return {
    canProceed,
    wizardProgress,
    isLoadingProgress,
    saveProgress
  };
};