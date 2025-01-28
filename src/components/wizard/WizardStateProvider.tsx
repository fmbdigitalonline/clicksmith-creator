import { createContext, useContext, ReactNode, useEffect, useRef, useState } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { useLocation } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { saveWizardState } from "@/utils/versionedSave";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { Json } from '@/integrations/supabase/types';

const WizardStateContext = createContext<ReturnType<typeof useAdWizardState> | undefined>(undefined);

const isBusinessIdea = (data: Json): data is BusinessIdea => {
  return typeof data === 'object' && data !== null && 'description' in data;
};

const isTargetAudience = (data: Json): data is TargetAudience => {
  return typeof data === 'object' && data !== null && 'segments' in data;
};

const isAudienceAnalysis = (data: Json): data is AudienceAnalysis => {
  return typeof data === 'object' && data !== null && 'marketDesire' in data;
};

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
  const [isLoading, setIsLoading] = useState(true);
  const [stateVersion, setStateVersion] = useState(1);
  const isSaving = useRef(false);
  const hasInitialized = useRef(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastAuthEvent = useRef<string | null>(null);
  const isAuthenticating = useRef(false);

  const syncWizardState = async (userId: string | undefined) => {
    if (isAuthenticating.current) {
      console.log('[WizardStateProvider] Sync already in progress, skipping');
      return;
    }

    try {
      console.log('[WizardStateProvider] Starting to sync wizard state for user:', userId);
      isAuthenticating.current = true;
      setIsLoading(true);

      if (userId) {
        const { data: progress } = await supabase
          .from('wizard_progress')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (progress) {
          console.log('[WizardStateProvider] Found existing progress:', progress);
          
          if (progress.business_idea && isBusinessIdea(progress.business_idea)) {
            state.setBusinessIdea(progress.business_idea);
          }
          if (progress.target_audience && isTargetAudience(progress.target_audience)) {
            state.setTargetAudience(progress.target_audience);
          }
          if (progress.audience_analysis && isAudienceAnalysis(progress.audience_analysis)) {
            state.setAudienceAnalysis(progress.audience_analysis);
          }
          
          setStateVersion(progress.version || 1);
          
          if (progress.current_step && progress.current_step > 0) {
            state.setCurrentStep(progress.current_step);
          }
        }

        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          const { data: anonymousData } = await supabase
            .from('anonymous_usage')
            .select('wizard_data')
            .eq('session_id', sessionId)
            .maybeSingle();

          if (anonymousData?.wizard_data) {
            await supabase
              .from('anonymous_usage')
              .update({ used: true })
              .eq('session_id', sessionId);

            localStorage.removeItem('anonymous_session_id');
          }
        }
      }
    } catch (error) {
      console.error('[WizardStateProvider] Error syncing state:', error);
      toast({
        title: "Error Loading Progress",
        description: "There was an error loading your progress. Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      hasInitialized.current = true;
      isAuthenticating.current = false;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[WizardStateProvider] Auth state changed:', event);
      
      if (event === 'INITIAL_SESSION' && lastAuthEvent.current === 'INITIAL_SESSION') {
        return;
      }
      
      lastAuthEvent.current = event;
      
      if (!hasInitialized.current && session?.user) {
        await syncWizardState(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        state.setBusinessIdea(null);
        state.setTargetAudience(null);
        state.setAudienceAnalysis(null);
        state.setCurrentStep(1);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [state]);

  useEffect(() => {
    const saveProgress = async () => {
      if (isSaving.current || !hasInitialized.current) {
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        if (saveTimeout.current) {
          clearTimeout(saveTimeout.current);
        }
        
        saveTimeout.current = setTimeout(async () => {
          try {
            isSaving.current = true;
            const result = await saveWizardState({
              user_id: user.id,
              business_idea: state.businessIdea,
              target_audience: state.targetAudience,
              audience_analysis: state.audienceAnalysis,
              current_step: state.currentStep
            }, stateVersion);
            
            if (result.success) {
              setStateVersion(result.newVersion);
            }
          } catch (error) {
            console.error('[WizardStateProvider] Save error:', error);
          } finally {
            isSaving.current = false;
          }
        }, 1000);
      }
    };

    saveProgress();

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, [state.businessIdea, state.targetAudience, state.audienceAnalysis, state.currentStep, stateVersion]);

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