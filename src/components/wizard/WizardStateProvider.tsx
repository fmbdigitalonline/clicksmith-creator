import { createContext, useContext, ReactNode, useEffect, useRef, useState } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { useLocation } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { debounce } from 'lodash';
import { Database } from '@/types/supabase';

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

// Define types for the locks table
interface Lock {
  key: string;
  expires_at: string;
}

// Update WizardData type to be JSON compatible
type JsonCompatible<T> = {
  [P in keyof T]: T[P] extends object ? JsonCompatible<T[P]> : T[P];
};

interface AnonymousData {
  wizard_data: {
    business_idea?: BusinessIdea;
    target_audience?: TargetAudience;
    audience_analysis?: AudienceAnalysis;
    current_step?: number;
    generated_ads?: any[];
  };
}

export const WizardStateProvider = ({ children }: { children: ReactNode }) => {
  const state = useAdWizardState();
  const location = useLocation();
  const { toast } = useToast();
  const saveInProgress = useRef(false);
  const hasInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  const getLock = async (lockKey: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('wizard_locks')
      .insert({
        lock_key: lockKey,
        expires_at: new Date(Date.now() + 30000).toISOString()
      } as Database['public']['Tables']['wizard_locks']['Insert'])
      .select()
      .single();

    return !error;
  };

  const releaseLock = async (lockKey: string): Promise<void> => {
    await supabase
      .from('wizard_locks')
      .delete()
      .eq('lock_key', lockKey);
  };

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
            
            if (progress.business_idea && isBusinessIdea(progress.business_idea)) {
              state.setBusinessIdea(progress.business_idea);
            }
            if (progress.target_audience && isTargetAudience(progress.target_audience)) {
              state.setTargetAudience(progress.target_audience);
            }
            if (progress.audience_analysis && isAudienceAnalysis(progress.audience_analysis)) {
              state.setAudienceAnalysis(progress.audience_analysis);
            }
            
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

  const debouncedSave = debounce(async (user: any, retryCount = 0, maxRetries = 3) => {
    const lockKey = `save-lock-${user.id}`;
    if (await getLock(lockKey)) {
      try {
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
          setTimeout(() => debouncedSave(user, retryCount + 1, maxRetries), 1000);
        }
      } finally {
        await releaseLock(lockKey);
        saveInProgress.current = false;
      }
    }
  }, 1000);

  const saveProgress = async () => {
    if (saveInProgress.current) {
      console.log('[WizardStateProvider] Save already in progress, skipping');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      saveInProgress.current = true;
      await debouncedSave(user);
    }
  };

  const syncAnonymousData = async () => {
    const sessionId = localStorage.getItem('anonymous_session_id');
    if (!sessionId) {
      console.log('[WizardStateProvider] No anonymous session found');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use a transaction to ensure data consistency
      const { data: migrationData, error: migrationError } = await supabase.rpc(
        'migrate_anonymous_to_authenticated',
        {
          p_session_id: sessionId,
          p_user_id: user.id
        }
      );

      if (migrationError) {
        throw migrationError;
      }

      // Fetch the migrated data
      const { data: wizardProgress, error: fetchError } = await supabase
        .from('wizard_progress')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      console.log('[WizardStateProvider] Fetched migrated data:', wizardProgress);

      // Update local state with the migrated data
      if (wizardProgress) {
        if (wizardProgress.business_idea) {
          state.setBusinessIdea(wizardProgress.business_idea as BusinessIdea);
          console.log('[WizardStateProvider] Set business idea:', wizardProgress.business_idea);
        }

        if (wizardProgress.target_audience) {
          state.setTargetAudience(wizardProgress.target_audience as TargetAudience);
          console.log('[WizardStateProvider] Set target audience:', wizardProgress.target_audience);
        }

        if (wizardProgress.audience_analysis) {
          state.setAudienceAnalysis(wizardProgress.audience_analysis as AudienceAnalysis);
          console.log('[WizardStateProvider] Set audience analysis:', wizardProgress.audience_analysis);
        }

        if (wizardProgress.current_step > 1) {
          state.setCurrentStep(wizardProgress.current_step);
          console.log('[WizardStateProvider] Set current step:', wizardProgress.current_step);
        }
      }

      // Clean up anonymous data after successful migration
      await supabase
        .from('anonymous_usage')
        .delete()
        .eq('session_id', sessionId);
      
      localStorage.removeItem('anonymous_session_id');
      console.log('[WizardStateProvider] Anonymous data cleaned up');

    } catch (error) {
      console.error('[WizardStateProvider] Error in migration process:', error);
    }
  };

  // Create a stored procedure in your database for atomic migration
  const createMigrationProcedure = `
  CREATE OR REPLACE FUNCTION migrate_anonymous_to_authenticated(
    p_session_id UUID,
    p_user_id UUID
  ) RETURNS JSONB AS $$
  DECLARE
    v_anonymous_data JSONB;
    v_result JSONB;
  BEGIN
    -- Get anonymous data
    SELECT wizard_data INTO v_anonymous_data
    FROM anonymous_usage
    WHERE session_id = p_session_id;

    IF v_anonymous_data IS NOT NULL THEN
      -- Insert or update wizard progress
      INSERT INTO wizard_progress (
        user_id,
        business_idea,
        target_audience,
        audience_analysis,
        current_step,
        updated_at
      )
      VALUES (
        p_user_id,
        v_anonymous_data->>'business_idea',
        v_anonymous_data->>'target_audience',
        v_anonymous_data->>'audience_analysis',
        COALESCE((v_anonymous_data->>'current_step')::int, 1),
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE
      SET
        business_idea = COALESCE(wizard_progress.business_idea, EXCLUDED.business_idea),
        target_audience = COALESCE(wizard_progress.target_audience, EXCLUDED.target_audience),
        audience_analysis = COALESCE(wizard_progress.audience_analysis, EXCLUDED.audience_analysis),
        current_step = GREATEST(wizard_progress.current_step, EXCLUDED.current_step),
        updated_at = NOW()
      RETURNING jsonb_build_object(
        'business_idea', business_idea,
        'target_audience', target_audience,
        'audience_analysis', audience_analysis,
        'current_step', current_step
      ) INTO v_result;
      
      RETURN v_result;
    END IF;
    
    RETURN NULL;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  // Add auth state change listener
  useEffect(() => {
    const handleAuthStateChange = async (event: string, session: any) => {
      if (event === 'SIGNED_IN') {
        console.log('[WizardStateProvider] Auth state changed to SIGNED_IN, starting migration');
        await syncAnonymousData();
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    return () => {
      subscription.unsubscribe();
    };
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
