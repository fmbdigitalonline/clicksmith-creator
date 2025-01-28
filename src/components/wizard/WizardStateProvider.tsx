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
  const authChangeProcessed = useRef(false);

  const syncWizardState = async (userId: string | undefined) => {
    try {
      console.log('[WizardStateProvider] Starting to sync wizard state for user:', userId);
      setIsLoading(true);

      if (userId) {
        // First check for existing progress
        const { data: progress } = await supabase
          .from('wizard_progress')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        // Get anonymous session data if it exists
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          console.log('[WizardStateProvider] Found anonymous session:', sessionId);
          const { data: anonymousData } = await supabase
            .from('anonymous_usage')
            .select('wizard_data, last_completed_step')
            .eq('session_id', sessionId)
            .maybeSingle();

          if (anonymousData?.wizard_data) {
            console.log('[WizardStateProvider] Found anonymous data:', anonymousData);
            try {
              const { data: migratedData } = await supabase
                .rpc('atomic_migration', { 
                  p_user_id: userId, 
                  p_session_id: sessionId 
                });

              if (migratedData) {
                console.log('[WizardStateProvider] Successfully migrated data:', migratedData);
                
                if (migratedData.business_idea && isBusinessIdea(migratedData.business_idea)) {
                  state.setBusinessIdea(migratedData.business_idea);
                }
                if (migratedData.target_audience && isTargetAudience(migratedData.target_audience)) {
                  state.setTargetAudience(migratedData.target_audience);
                }
                if (migratedData.audience_analysis && isAudienceAnalysis(migratedData.audience_analysis)) {
                  state.setAudienceAnalysis(migratedData.audience_analysis);
                }
                
                const targetStep = Math.max(
                  migratedData.current_step || 1,
                  anonymousData.last_completed_step || 1
                );
                
                state.setCurrentStep(targetStep);
                setStateVersion(migratedData.version || 1);
                
                localStorage.removeItem('anonymous_session_id');
                
                toast({
                  title: "Progress Restored",
                  description: "Your previous work has been saved to your account.",
                });
              }
            } catch (error) {
              console.error('[WizardStateProvider] Migration error:', error);
              toast({
                title: "Error Restoring Progress",
                description: "There was an error restoring your previous work.",
                variant: "destructive",
              });
            }
          }
        } else if (progress) {
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
          if (progress.current_step) {
            state.setCurrentStep(progress.current_step);
          }
          setStateVersion(progress.version || 1);
        }
      }
    } catch (error) {
      console.error('[WizardStateProvider] Error syncing state:', error);
      toast({
        title: "Error Loading Progress",
        description: "There was an error loading your progress.",
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
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
