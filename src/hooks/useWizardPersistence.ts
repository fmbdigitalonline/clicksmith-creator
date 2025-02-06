import { useCallback, useEffect } from 'react';
import { useWizardStore } from '@/stores/wizardStore';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveQueue } from '@/utils/saveQueue';
import { BusinessIdea, TargetAudience, AudienceAnalysis } from '@/types/adWizard';

export const useWizardPersistence = () => {
  const { toast } = useToast();
  const {
    businessIdea,
    targetAudience,
    audienceAnalysis,
    currentStep,
    selectedHooks,
  } = useWizardStore();

  const saveProgress = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const progressData = {
        user_id: user.id,
        business_idea: businessIdea,
        target_audience: targetAudience,
        audience_analysis: audienceAnalysis,
        current_step: currentStep,
        selected_hooks: selectedHooks,
        updated_at: new Date().toISOString(),
      };

      await saveQueue.add(async () => {
        const { error } = await supabase
          .from('wizard_progress')
          .upsert(progressData, {
            onConflict: 'user_id'
          });

        if (error) throw error;
      });

    } catch (error) {
      console.error('[WizardPersistence] Error saving progress:', error);
      toast({
        title: "Error Saving Progress",
        description: "Your progress couldn't be saved. Please try again.",
        variant: "destructive",
      });
    }
  }, [businessIdea, targetAudience, audienceAnalysis, currentStep, selectedHooks, toast]);

  // Save progress before unloading
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveProgress();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveProgress();
    };
  }, [saveProgress]);

  return { saveProgress };
};