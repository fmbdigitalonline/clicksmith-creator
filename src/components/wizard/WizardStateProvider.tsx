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
    console.log('[WizardStateProvider] Starting to sync anonymous data');
    const sessionId = localStorage.getItem('anonymous_session_id');
    if (!sessionId) {
      console.log('[WizardStateProvider] No anonymous session found');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First, get the anonymous data
      const { data: anonymousData } = await supabase
        .from('anonymous_usage')
        .select('wizard_data')
        .eq('session_id', sessionId)
        .single();

      if (anonymousData?.wizard_data) {
        console.log('[WizardStateProvider] Found anonymous data to migrate:', anonymousData.wizard_data);

        // Get or create wizard progress
        const { data: existingProgress } = await supabase
          .from('wizard_progress')
          .select('*')
          .eq('user_id', user.id)
          .single();

        const wizardData = anonymousData.wizard_data as JsonCompatible<WizardData>;
        
        // Prepare the data to be saved
        const dataToSave = {
          user_id: user.id,
          business_idea: wizardData.business_idea || existingProgress?.business_idea || null,
          target_audience: wizardData.target_audience || existingProgress?.target_audience || null,
          audience_analysis: wizardData.audience_analysis || existingProgress?.audience_analysis || null,
          current_step: Math.max(
            wizardData.current_step || 1,
            existingProgress?.current_step || 1
          ),
          updated_at: new Date().toISOString()
        };

        console.log('[WizardStateProvider] Saving migrated data:', dataToSave);

        // Save the data
        const { data: savedData, error } = await supabase
          .from('wizard_progress')
          .upsert(dataToSave)
          .select()
          .single();

        if (error) {
          throw error;
        }

        // Update local state
        if (savedData.business_idea) {
          state.setBusinessIdea(savedData.business_idea as BusinessIdea);
        }
        if (savedData.target_audience) {
          state.setTargetAudience(savedData.target_audience as TargetAudience);
        }
        if (savedData.audience_analysis) {
          state.setAudienceAnalysis(savedData.audience_analysis as AudienceAnalysis);
        }
        if (savedData.current_step > 1) {
          state.setCurrentStep(savedData.current_step);
        }

        // Clean up anonymous data
        await supabase
          .from('anonymous_usage')
          .delete()
          .eq('session_id', sessionId);
        
        localStorage.removeItem('anonymous_session_id');

        console.log('[WizardStateProvider] Migration completed successfully');
      }
    } catch (error) {
      console.error('[WizardStateProvider] Error syncing anonymous data:', error);
    }
  };

  // Add this effect to trigger migration on auth state change
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
