import { createContext, useContext, ReactNode, useEffect, useRef, useState } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { saveWizardState } from "@/utils/versionedSave";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";

// Define the context type explicitly to prevent recursion
type WizardContextType = ReturnType<typeof useAdWizardState>;
const WizardStateContext = createContext<WizardContextType | undefined>(undefined);

// Type guard functions with explicit type checks
const isBusinessIdea = (data: unknown): data is BusinessIdea => {
  if (!data || typeof data !== 'object') return false;
  const idea = data as Record<string, unknown>;
  return typeof idea.description === 'string';
};

const isTargetAudience = (data: unknown): data is TargetAudience => {
  if (!data || typeof data !== 'object') return false;
  const audience = data as Record<string, unknown>;
  return Array.isArray(audience.segments);
};

const isAudienceAnalysis = (data: unknown): data is AudienceAnalysis => {
  if (!data || typeof data !== 'object') return false;
  const analysis = data as Record<string, unknown>;
  return typeof analysis.marketDesire === 'string';
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [stateVersion, setStateVersion] = useState(1);
  const isSaving = useRef(false);
  const hasInitialized = useRef(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const migrationInProgress = useRef(false);
  const migrationLockId = useRef<string | null>(null);

  const acquireMigrationLock = async (userId: string): Promise<boolean> => {
    try {
      const lockId = crypto.randomUUID();
      const { data, error } = await supabase
        .from('migration_locks')
        .insert({
          user_id: userId,
          lock_type: 'wizard_migration',
          expires_at: new Date(Date.now() + 30000).toISOString(),
          metadata: { lockId }
        })
        .select()
        .single();

      if (error) {
        console.error('[WizardStateProvider] Lock acquisition failed:', error);
        return false;
      }

      migrationLockId.current = lockId;
      return true;
    } catch (error) {
      console.error('[WizardStateProvider] Lock error:', error);
      return false;
    }
  };

  const releaseMigrationLock = async (userId: string) => {
    if (migrationLockId.current) {
      try {
        await supabase
          .from('migration_locks')
          .delete()
          .eq('user_id', userId)
          .eq('metadata->lockId', migrationLockId.current);
      } catch (error) {
        console.error('[WizardStateProvider] Lock release error:', error);
      }
      migrationLockId.current = null;
    }
  };

  const syncWizardState = async (userId: string | undefined) => {
    if (!userId || migrationInProgress.current) {
      console.log('[WizardStateProvider] Skipping sync - no user or migration in progress');
      return;
    }

    try {
      console.log('[WizardStateProvider] Starting sync for user:', userId);
      setIsLoading(true);
      migrationInProgress.current = true;

      const hasLock = await acquireMigrationLock(userId);
      if (!hasLock) {
        console.log('[WizardStateProvider] Could not acquire migration lock');
        return;
      }

      const sessionId = localStorage.getItem('anonymous_session_id');
      const { data: progress } = await supabase
        .from('wizard_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (sessionId && !progress) {
        console.log('[WizardStateProvider] Found anonymous session:', sessionId);
        const { data: anonymousData } = await supabase
          .from('anonymous_usage')
          .select('wizard_data, last_completed_step')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (anonymousData?.wizard_data) {
          try {
            const { data: migratedData } = await supabase
              .rpc('atomic_migration', { 
                p_user_id: userId, 
                p_session_id: sessionId 
              });

            if (migratedData) {
              console.log('[WizardStateProvider] Migration successful:', migratedData);
              
              if (isBusinessIdea(migratedData.business_idea)) {
                state.setBusinessIdea(migratedData.business_idea);
              }
              if (isTargetAudience(migratedData.target_audience)) {
                state.setTargetAudience(migratedData.target_audience);
              }
              if (isAudienceAnalysis(migratedData.audience_analysis)) {
                state.setAudienceAnalysis(migratedData.audience_analysis);
              }
              
              const targetStep = Math.max(
                migratedData.current_step || 1,
                anonymousData.last_completed_step || 1
              );
              
              state.setCurrentStep(targetStep);
              setStateVersion(migratedData.version || 1);
              
              if (targetStep > 1 && location.pathname === '/ad-wizard/new') {
                navigate(`/ad-wizard/step-${targetStep}`, { replace: true });
              }
              
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
        console.log('[WizardStateProvider] Loading existing progress');
        
        if (isBusinessIdea(progress.business_idea)) {
          state.setBusinessIdea(progress.business_idea);
        }
        if (isTargetAudience(progress.target_audience)) {
          state.setTargetAudience(progress.target_audience);
        }
        if (isAudienceAnalysis(progress.audience_analysis)) {
          state.setAudienceAnalysis(progress.audience_analysis);
        }
        
        if (progress.current_step) {
          state.setCurrentStep(progress.current_step);
          if (progress.current_step > 1 && location.pathname === '/ad-wizard/new') {
            navigate(`/ad-wizard/step-${progress.current_step}`, { replace: true });
          }
        }
        setStateVersion(progress.version || 1);
      }
    } catch (error) {
      console.error('[WizardStateProvider] Sync error:', error);
      toast({
        title: "Error Loading Progress",
        description: "There was an error loading your progress.",
        variant: "destructive",
      });
    } finally {
      if (userId) {
        await releaseMigrationLock(userId);
      }
      setIsLoading(false);
      hasInitialized.current = true;
      migrationInProgress.current = false;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[WizardStateProvider] Auth state changed:', event);
      
      if (session?.user && !hasInitialized.current) {
        await syncWizardState(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

  return (
    <WizardStateContext.Provider value={state}>
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-2">Loading wizard...</span>
        </div>
      ) : (
        children
      )}
    </WizardStateContext.Provider>
  );
};

export default WizardStateProvider;
