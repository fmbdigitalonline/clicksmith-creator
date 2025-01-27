import { createContext, useContext, ReactNode, useEffect, useRef, useState } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { useLocation } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { debounce } from 'lodash';
import { Json } from "@/integrations/supabase/types";
import _ from 'lodash';

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

const validateMigration = (source: any, target: any): boolean => {
  if (!source || !target) return false;

  // Validate business_idea
  if (source.business_idea && !target.business_idea) return false;
  if (source.business_idea && !isBusinessIdea(target.business_idea)) return false;

  // Validate target_audience
  if (source.target_audience && !target.target_audience) return false;
  if (source.target_audience && !isTargetAudience(target.target_audience)) return false;

  // Validate audience_analysis
  if (source.audience_analysis && !target.audience_analysis) return false;
  if (source.audience_analysis && !isAudienceAnalysis(target.audience_analysis)) return false;

  return true;
};

const retryMigration = async (
  userId: string, 
  sessionId: string, 
  attempts = 0
): Promise<{ success: boolean; data?: WizardData; error?: string }> => {
  try {
    await new Promise(resolve => setTimeout(resolve, 500 * (attempts + 1)));
    
    const { data: anonymousData } = await supabase
      .from('anonymous_usage')
      .select('wizard_data')
      .eq('session_id', sessionId)
      .single();

    if (!anonymousData?.wizard_data) {
      console.error('[Migration] No anonymous data found');
      return { success: false, error: 'No anonymous data found' };
    }

    console.log('[Migration] Anonymous data found:', anonymousData.wizard_data);

    const { data: migratedData, error: migrationError } = await supabase
      .rpc('migrate_wizard_data', {
        p_user_id: userId,
        p_session_id: sessionId,
        p_wizard_data: anonymousData.wizard_data
      });

    if (migrationError) {
      console.error('[Migration] Error:', migrationError);
      throw migrationError;
    }

    console.log('[Migration] Migrated data:', migratedData);

    const isValid = validateMigration(anonymousData.wizard_data, migratedData);
    
    if (!isValid) {
      console.error('[Migration] Validation failed');
      throw new Error('Migration validation failed');
    }

    return { success: true, data: migratedData as WizardData };
  } catch (error) {
    console.error(`[Migration] Attempt ${attempts + 1} failed:`, error);
    
    if (attempts < 3) {
      return retryMigration(userId, sessionId, attempts + 1);
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

export const WizardStateProvider = ({ children }: { children: ReactNode }) => {
  const state = useAdWizardState();
  const location = useLocation();
  const { toast } = useToast();
  const saveInProgress = useRef(false);
  const hasInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const migrationInProgress = useRef(false);

  const getLock = async (lockKey: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('migration_locks')
      .insert({
        lock_type: lockKey,
        expires_at: new Date(Date.now() + 30000).toISOString()
      })
      .select()
      .single();

    return !error;
  };

  const releaseLock = async (lockKey: string): Promise<void> => {
    await supabase
      .from('migration_locks')
      .delete()
      .eq('lock_type', lockKey);
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

  const syncAnonymousData = async () => {
    const sessionId = localStorage.getItem('anonymous_session_id');
    if (!sessionId || migrationInProgress.current) return;

    try {
      migrationInProgress.current = true;
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      console.log('[WizardStateProvider] Starting migration for user:', user.id);

      const result = await retryMigration(user.id, sessionId);

      if (result.success && result.data) {
        // Update local state with type checking
        if (result.data.business_idea && isBusinessIdea(result.data.business_idea)) {
          state.setBusinessIdea(result.data.business_idea);
        }
        if (result.data.target_audience && isTargetAudience(result.data.target_audience)) {
          state.setTargetAudience(result.data.target_audience);
        }
        if (result.data.audience_analysis && isAudienceAnalysis(result.data.audience_analysis)) {
          state.setAudienceAnalysis(result.data.audience_analysis);
        }
        if (result.data.current_step && result.data.current_step > 1) {
          state.setCurrentStep(result.data.current_step);
        }

        // Clean up anonymous data
        await supabase
          .from('anonymous_usage')
          .delete()
          .eq('session_id', sessionId);
        
        localStorage.removeItem('anonymous_session_id');
        
        console.log('[WizardStateProvider] Migration completed successfully');

        toast({
          title: "Progress Restored",
          description: "Your previous work has been saved to your account.",
        });
      } else {
        throw new Error(result.error || 'Migration failed');
      }
    } catch (error) {
      console.error('[WizardStateProvider] Migration error:', error);
      toast({
        title: "Error During Migration",
        description: "There was an error saving your progress. Please try again.",
        variant: "destructive",
      });
    } finally {
      migrationInProgress.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleAuthStateChange = async (event: string, session: any) => {
      if (event === 'SIGNED_IN') {
        await syncAnonymousData();
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    return () => {
      subscription.unsubscribe();
    };
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
