import { createContext, useContext, ReactNode, useEffect, useRef } from 'react';
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const WizardStateProvider = ({ children }: { children: ReactNode }) => {
  const state = useAdWizardState();
  const location = useLocation();
  const { toast } = useToast();
  const saveInProgress = useRef(false);

  const getCurrentStepFromUrl = () => {
    const match = location.pathname.match(/step-(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  const saveProgress = async (retryCount = 0, maxRetries = 3) => {
    if (saveInProgress.current) {
      console.log('[WizardStateProvider] Save already in progress, skipping');
      return;
    }

    console.log('[WizardStateProvider] Starting to save progress, attempt:', retryCount + 1);
    const sessionId = localStorage.getItem('anonymous_session_id');
    if (!sessionId) return;

    try {
      saveInProgress.current = true;
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // First get the current version with a lock
        const { data: currentData, error: versionError } = await supabase
          .from('wizard_progress')
          .select('version')
          .eq('user_id', user.id)
          .single();

        if (versionError && !versionError.message.includes('No rows found')) {
          console.error('[WizardStateProvider] Error fetching version:', versionError);
          throw versionError;
        }

        const newVersion = (currentData?.version || 0) + 1;
        console.log('[WizardStateProvider] Saving with version:', newVersion);
        
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
          
          if (error.message.includes('Concurrent save detected') && retryCount < maxRetries) {
            const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
            console.log(`[WizardStateProvider] Retrying save in ${backoffTime}ms (attempt ${retryCount + 1}/${maxRetries})`);
            await delay(backoffTime);
            saveInProgress.current = false;
            return saveProgress(retryCount + 1, maxRetries);
          }
          
          if (retryCount === maxRetries) {
            toast({
              title: "Warning",
              description: "Having trouble saving your progress. Don't worry, we'll keep trying!",
              variant: "default",
            });
          }
          throw error;
        }
      } else {
        // Handle anonymous user save
        const { error: anonError } = await supabase
          .from('anonymous_usage')
          .upsert({
            session_id: sessionId,
            wizard_data: {
              business_idea: state.businessIdea,
              target_audience: state.targetAudience,
              audience_analysis: state.audienceAnalysis,
              current_step: state.currentStep,
              updated_at: new Date().toISOString()
            }
          }, {
            onConflict: 'session_id'
          });

        if (anonError) {
          console.error('[WizardStateProvider] Error saving anonymous progress:', anonError);
          throw anonError;
        }
      }
    } catch (error) {
      console.error('[WizardStateProvider] Unexpected error:', error);
      if (retryCount === maxRetries) {
        toast({
          title: "Error Saving Progress",
          description: "We're having trouble saving your progress. Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      saveInProgress.current = false;
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
    const debounceTimeout = setTimeout(() => {
      saveProgress();
    }, 1000);

    return () => {
      clearTimeout(debounceTimeout);
    };
  }, [state.businessIdea, state.targetAudience, state.audienceAnalysis, state.currentStep]);
  
  return (
    <WizardStateContext.Provider value={state}>
      {children}
    </WizardStateContext.Provider>
  );
};