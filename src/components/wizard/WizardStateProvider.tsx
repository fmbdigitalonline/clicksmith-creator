import { createContext, useContext, ReactNode, useEffect, useRef, useState } from 'react';
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

const isBusinessIdea = (data: any): data is BusinessIdea => {
  return data && typeof data === 'object' && 'description' in data;
};

const isTargetAudience = (data: any): data is TargetAudience => {
  return data && typeof data === 'object' && 'description' in data;
};

const isAudienceAnalysis = (data: any): data is AudienceAnalysis => {
  return data && typeof data === 'object' && 'expandedDefinition' in data;
};

export const WizardStateProvider = ({ children }: { children: ReactNode }) => {
  const state = useAdWizardState();
  const location = useLocation();
  const { toast } = useToast();
  const saveInProgress = useRef(false);
  const hasInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  const canNavigateToStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return true;
      case 2:
        return !!state.businessIdea;
      case 3:
        return !!state.businessIdea && !!state.targetAudience;
      case 4:
        return !!state.businessIdea && !!state.targetAudience && !!state.audienceAnalysis;
      default:
        return false;
    }
  };

  const getCurrentStepFromUrl = () => {
    const match = location.pathname.match(/step-(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  useEffect(() => {
    const urlStep = getCurrentStepFromUrl();
    if (urlStep && urlStep !== state.currentStep && canNavigateToStep(urlStep)) {
      console.log('[WizardStateProvider] Synchronizing step from URL:', urlStep);
      state.setCurrentStep(urlStep);
    }
  }, [location.pathname]);

  useEffect(() => {
    const syncWizardState = async () => {
      try {
        if (hasInitialized.current) return;
        
        console.log('[WizardStateProvider] Starting to sync wizard state');
        setIsLoading(true);
        
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: progress } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (progress) {
            console.log('[WizardStateProvider] Found existing progress:', progress);
            
            // Update all states at once
            if (progress.business_idea && isBusinessIdea(progress.business_idea)) {
              state.setBusinessIdea(progress.business_idea);
            }
            if (progress.target_audience && isTargetAudience(progress.target_audience)) {
              state.setTargetAudience(progress.target_audience);
            }
            if (progress.audience_analysis && isAudienceAnalysis(progress.audience_analysis)) {
              state.setAudienceAnalysis(progress.audience_analysis);
            }
            
            // Ensure the step is properly set
            const urlStep = getCurrentStepFromUrl();
            const targetStep = Math.max(progress.current_step || 1, urlStep || 1);
            
            if (targetStep > 1 && canNavigateToStep(targetStep)) {
              console.log('[WizardStateProvider] Setting step to:', targetStep);
              state.setCurrentStep(targetStep);
            }
          }
        }
        
        hasInitialized.current = true;
      } catch (error) {
        console.error('[WizardStateProvider] Error syncing state:', error);
        toast({
          title: "Error Loading Progress",
          description: "There was an error loading your progress. Please try refreshing the page.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    syncWizardState();
  }, []);

  const saveProgress = async (retryCount = 0, maxRetries = 3) => {
    if (saveInProgress.current) {
      console.log('[WizardStateProvider] Save already in progress, skipping');
      return;
    }

    console.log('[WizardStateProvider] Starting to save progress, attempt:', retryCount + 1);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      try {
        saveInProgress.current = true;
        
        const { error } = await supabase
          .from('wizard_progress')
          .upsert({
            user_id: user.id,
            business_idea: state.businessIdea,
            target_audience: state.targetAudience,
            audience_analysis: state.audienceAnalysis,
            current_step: state.currentStep,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;
        
      } catch (error) {
        console.error('[WizardStateProvider] Error saving progress:', error);
        if (retryCount < maxRetries) {
          setTimeout(() => saveProgress(retryCount + 1, maxRetries), 1000);
        }
      } finally {
        saveInProgress.current = false;
      }
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
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Loading wizard...</span>
      </div>
    );
  }

  return (
    <WizardStateContext.Provider value={state}>
      {children}
    </WizardStateContext.Provider>
  );
};
