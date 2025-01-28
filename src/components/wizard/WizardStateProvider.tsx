import { createContext, useContext, ReactNode, useEffect, useRef, useState } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { useLocation } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { saveWizardState } from "@/utils/versionedSave";

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
  const [isLoading, setIsLoading] = useState(true);
  const [stateVersion, setStateVersion] = useState(1);
  const isSaving = useRef(false);
  const hasInitialized = useRef(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const authChangeProcessed = useRef(false);

  const syncWizardState = async (userId: string | undefined) => {
    try {
      console.log('[WizardStateProvider] Starting to sync wizard state for user:', userId);
      setIsLoading(true);

      if (userId) {
        const { data: progress } = await supabase
          .from('wizard_progress')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (progress) {
          console.log('[WizardStateProvider] Found existing progress:', progress);
          
          if (progress.business_idea) state.setBusinessIdea(progress.business_idea);
          if (progress.target_audience) state.setTargetAudience(progress.target_audience);
          if (progress.audience_analysis) state.setAudienceAnalysis(progress.audience_analysis);
          
          setStateVersion(progress.version || 1);
          
          // Only update step if it's greater than current
          if (progress.current_step && progress.current_step > state.currentStep) {
            state.setCurrentStep(progress.current_step);
          }
        }

        // Clear anonymous data after successful sync
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          await supabase
            .from('anonymous_usage')
            .update({ used: true })
            .eq('session_id', sessionId);
          localStorage.removeItem('anonymous_session_id');
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
    }
  };

  // Handle auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[WizardStateProvider] Auth state changed:', event);
      
      if (!authChangeProcessed.current && session?.user) {
        authChangeProcessed.current = true;
        await syncWizardState(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        authChangeProcessed.current = false;
        // Reset state on sign out
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

  // Initial sync
  useEffect(() => {
    const initializeState = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!hasInitialized.current) {
        await syncWizardState(user?.id);
      }
    };

    initializeState();
  }, []);

  const queueSave = async (data: Partial<WizardData>) => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    if (isSaving.current) {
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    isSaving.current = true;

    try {
      const saveData = {
        ...data,
        user_id: user.id,
        last_save_attempt: new Date().toISOString(),
        current_step: state.currentStep
      };
      
      const result = await saveWizardState(saveData, stateVersion);
      
      if (result.success) {
        setStateVersion(result.newVersion);
        
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          await supabase
            .from('anonymous_usage')
            .update({
              last_completed_step: state.currentStep,
              wizard_data: saveData
            })
            .eq('session_id', sessionId);
        }
      }
    } catch (error) {
      console.error('[WizardStateProvider] Error in save queue:', error);
      toast({
        title: "Save Error",
        description: "Failed to save changes. Your progress may be lost.",
        variant: "destructive",
      });
    } finally {
      isSaving.current = false;
    }
  };

  const canNavigateToStep = (step: number): boolean => {
    switch (step) {
      case 1: return true;
      case 2: return !!state.businessIdea;
      case 3: return !!state.businessIdea && !!state.targetAudience;
      case 4: return !!state.businessIdea && !!state.targetAudience && !!state.audienceAnalysis;
      default: return false;
    }
  };

  useEffect(() => {
    const saveProgress = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        if (saveTimeout.current) {
          clearTimeout(saveTimeout.current);
        }
        
        saveTimeout.current = setTimeout(() => {
          queueSave({
            user_id: user.id,
            business_idea: state.businessIdea,
            target_audience: state.targetAudience,
            audience_analysis: state.audienceAnalysis,
            current_step: state.currentStep
          });
        }, 1000);
      }
    };

    saveProgress();

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
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
