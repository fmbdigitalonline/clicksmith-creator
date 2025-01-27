import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const { toast } = useToast();

  const getCurrentStepFromUrl = () => {
    const match = location.pathname.match(/step-(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  const saveProgress = async (retryCount = 0) => {
    console.log('[WizardStateProvider] Starting to save progress');
    const sessionId = localStorage.getItem('anonymous_session_id');
    if (!sessionId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // First get the current version
        const { data: currentData } = await supabase
          .from('wizard_progress')
          .select('version')
          .eq('user_id', user.id)
          .maybeSingle();

        const newVersion = (currentData?.version || 0) + 1;
        
        const { error } = await supabase
          .from('wizard_progress')
          .upsert({
            user_id: user.id,
            business_idea: state.businessIdea,
            target_audience: state.targetAudience,
            audience_analysis: state.audienceAnalysis,
            current_step: state.currentStep,
            version: newVersion,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (error) {
          console.error('[WizardStateProvider] Error saving progress:', error);
          
          // If it's a concurrent save error and we haven't retried too many times
          if (error.message.includes('Concurrent save detected') && retryCount < 3) {
            console.log(`[WizardStateProvider] Retrying save (attempt ${retryCount + 1})`);
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return saveProgress(retryCount + 1);
          }
          
          toast({
            title: "Error Saving Progress",
            description: "There was an error saving your progress. Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('[WizardStateProvider] Unexpected error:', error);
    }
  };

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
            state.setBusinessIdea(wizardData.business_idea as BusinessIdea);
          }
          if (wizardData.target_audience && typeof wizardData.target_audience === 'object') {
            state.setTargetAudience(wizardData.target_audience as TargetAudience);
          }
          if (wizardData.audience_analysis && typeof wizardData.audience_analysis === 'object') {
            state.setAudienceAnalysis(wizardData.audience_analysis as AudienceAnalysis);
          }

          const urlStep = getCurrentStepFromUrl();
          const wizardStep = wizardData.current_step;
          
          const targetStep = Math.max(
            urlStep || 1,
            wizardStep || 1
          );

          if (targetStep > 1) {
            state.setCurrentStep(targetStep);
          }
        }
      } catch (error) {
        console.error('[WizardStateProvider] Error syncing anonymous data:', error);
      }
    };

    syncAnonymousData();
  }, []);

  useEffect(() => {
    saveProgress();
  }, [state.businessIdea, state.targetAudience, state.audienceAnalysis, state.currentStep]);
  
  return (
    <WizardStateContext.Provider value={state}>
      {children}
    </WizardStateContext.Provider>
  );
};