import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";

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
      console.log('[WizardStateProvider] Starting to sync anonymous data');
      const sessionId = localStorage.getItem('anonymous_session_id');
      if (!sessionId) {
        console.log('[WizardStateProvider] No anonymous session found');
        return;
      }

      try {
        const { data: anonymousData } = await supabase
          .from('anonymous_usage')
          .select('wizard_data')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (anonymousData?.wizard_data) {
          console.log('[WizardStateProvider] Found anonymous data:', anonymousData.wizard_data);
          const wizardData = anonymousData.wizard_data as WizardData;
          
          if (wizardData.business_idea && typeof wizardData.business_idea === 'object') {
            console.log('[WizardStateProvider] Setting business idea');
            state.setBusinessIdea(wizardData.business_idea as BusinessIdea);
          }
          if (wizardData.target_audience && typeof wizardData.target_audience === 'object') {
            console.log('[WizardStateProvider] Setting target audience');
            state.setTargetAudience(wizardData.target_audience as TargetAudience);
          }
          if (wizardData.audience_analysis && typeof wizardData.audience_analysis === 'object') {
            console.log('[WizardStateProvider] Setting audience analysis');
            state.setAudienceAnalysis(wizardData.audience_analysis as AudienceAnalysis);
          }
          if (wizardData.current_step && typeof wizardData.current_step === 'number' && wizardData.current_step > 1) {
            console.log('[WizardStateProvider] Setting current step:', wizardData.current_step);
            state.setCurrentStep(wizardData.current_step);
          }
        }
      } catch (error) {
        console.error('[WizardStateProvider] Error syncing anonymous data:', error);
      }
    };

    syncAnonymousData();
  }, []);

  useEffect(() => {
    const saveProgress = async () => {
      console.log('[WizardStateProvider] Starting to save progress');
      const sessionId = localStorage.getItem('anonymous_session_id');
      if (!sessionId) return;

      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        console.log('[WizardStateProvider] Saving progress for authenticated user:', user.id);
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
        console.log('[WizardStateProvider] Saving progress for anonymous user:', sessionId);
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

    // Add auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[WizardStateProvider] Auth state changed:', event);
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('[WizardStateProvider] User signed in, checking for existing progress');
        const { data: existingProgress } = await supabase
          .from('wizard_progress')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (existingProgress) {
          console.log('[WizardStateProvider] Found existing progress:', existingProgress);
          if (existingProgress.business_idea && typeof existingProgress.business_idea === 'object') {
            state.setBusinessIdea(existingProgress.business_idea as BusinessIdea);
          }
          if (existingProgress.target_audience && typeof existingProgress.target_audience === 'object') {
            state.setTargetAudience(existingProgress.target_audience as TargetAudience);
          }
          if (existingProgress.audience_analysis && typeof existingProgress.audience_analysis === 'object') {
            state.setAudienceAnalysis(existingProgress.audience_analysis as AudienceAnalysis);
          }
          if (existingProgress.current_step && typeof existingProgress.current_step === 'number' && existingProgress.current_step > 1) {
            state.setCurrentStep(existingProgress.current_step);
          }
        }
      }
    });

    saveProgress();

    return () => {
      subscription.unsubscribe();
    };
  }, [state.businessIdea, state.targetAudience, state.audienceAnalysis, state.currentStep]);
  
  return (
    <WizardStateContext.Provider value={state}>
      {children}
    </WizardStateContext.Provider>
  );
};