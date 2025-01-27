import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";

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
  
  useEffect(() => {
    const syncAnonymousData = async () => {
      const sessionId = localStorage.getItem('anonymous_session_id');
      if (!sessionId) return;

      const { data: anonymousData } = await supabase
        .from('anonymous_usage')
        .select('wizard_data')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (anonymousData?.wizard_data) {
        const { business_idea, target_audience, audience_analysis, current_step } = anonymousData.wizard_data;
        
        if (business_idea) state.setBusinessIdea(business_idea);
        if (target_audience) state.setTargetAudience(target_audience);
        if (audience_analysis) state.setAudienceAnalysis(audience_analysis);
        if (current_step && current_step > 1) state.setCurrentStep(current_step);
      }
    };

    syncAnonymousData();
  }, []);

  useEffect(() => {
    const saveProgress = async () => {
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
    };

    saveProgress();
  }, [state.businessIdea, state.targetAudience, state.audienceAnalysis, state.currentStep]);
  
  return (
    <WizardStateContext.Provider value={state}>
      {children}
    </WizardStateContext.Provider>
  );
};