import { createContext, useContext, ReactNode, useEffect, useCallback } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { useToast } from "@/hooks/use-toast";

const WizardStateContext = createContext<ReturnType<typeof useAdWizardState> | undefined>(undefined);

export const useWizardState = () => {
  const context = useContext(WizardStateContext);
  if (!context) {
    throw new Error('useWizardState must be used within a WizardStateProvider');
  }
  return context;
};

export const WizardStateProvider = ({ children }: { children: ReactNode }) => {
  const state = useAdWizardState();
  const { toast } = useToast();

  const syncAnonymousData = useCallback(async () => {
    try {
      const sessionId = localStorage.getItem('anonymous_session_id');
      if (!sessionId) return;

      const { data: anonymousData } = await supabase
        .from('anonymous_usage')
        .select('wizard_data')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (anonymousData?.wizard_data) {
        const wizardData = anonymousData.wizard_data as WizardData;
        const { business_idea, target_audience, audience_analysis, current_step } = wizardData;
        
        if (business_idea) state.setBusinessIdea(business_idea);
        if (target_audience) state.setTargetAudience(target_audience);
        if (audience_analysis) state.setAudienceAnalysis(audience_analysis);
        if (current_step && current_step > 1) state.setCurrentStep(current_step);
      }
    } catch (error) {
      console.error('[WizardStateProvider] Error syncing anonymous data:', error);
      toast({
        title: "Error",
        description: "Failed to sync your progress. Please try refreshing the page.",
        variant: "destructive",
      });
    }
  }, [state, toast]);

  useEffect(() => {
    const saveProgress = async () => {
      try {
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (!sessionId) return;

        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // User is authenticated, save to wizard_progress
          await supabase
            .from('wizard_progress')
            .upsert({
              user_id: user.id,
              business_idea: state.businessIdea,
              target_audience: state.targetAudience,
              audience_analysis: state.audienceAnalysis,
              current_step: state.currentStep,
              version: 1
            }, {
              onConflict: 'user_id'
            });
        } else {
          // Anonymous user, update anonymous_usage
          await supabase
            .from('anonymous_usage')
            .update({
              wizard_data: {
                business_idea: state.businessIdea,
                target_audience: state.targetAudience,
                audience_analysis: state.audienceAnalysis,
                current_step: state.currentStep
              },
              last_completed_step: state.currentStep
            })
            .eq('session_id', sessionId);
        }
      } catch (error) {
        console.error('[WizardStateProvider] Error saving progress:', error);
      }
    };

    const debounceTimeout = setTimeout(saveProgress, 1000);
    return () => clearTimeout(debounceTimeout);
  }, [state.businessIdea, state.targetAudience, state.audienceAnalysis, state.currentStep]);

  useEffect(() => {
    syncAnonymousData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        await syncAnonymousData();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [syncAnonymousData]);
  
  return (
    <WizardStateContext.Provider value={state}>
      {children}
    </WizardStateContext.Provider>
  );
};