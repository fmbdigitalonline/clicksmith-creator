import { createContext, useContext, ReactNode, useEffect, useRef, useState } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { useLocation } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { debounce } from 'lodash';
import { Json } from "@/integrations/supabase/types";

// Field mapping to ensure consistency
const FIELD_MAPPING = {
  businessIdea: 'business_idea',
  targetAudience: 'target_audience',
  audienceAnalysis: 'audience_analysis',
  currentStep: 'current_step',
  selectedHooks: 'selected_hooks',
  generatedAds: 'generated_ads',
  adFormat: 'ad_format',
  videoAdPreferences: 'video_ad_preferences',
} as const;

const WizardStateContext = createContext<ReturnType<typeof useAdWizardState> | undefined>(undefined);

export const useWizardState = () => {
  const context = useContext(WizardStateContext);
  if (!context) {
    throw new Error('useWizardState must be used within a WizardStateProvider');
  }
  return context;
};

// Helper functions for locking mechanism
const acquireLock = async (lockKey: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('migration_locks')
      .insert([{ 
        lock_type: lockKey,
        expires_at: new Date(Date.now() + 30000).toISOString() // 30 second lock
      }])
      .single();
    
    return !error;
  } catch {
    return false;
  }
};

const releaseLock = async (lockKey: string): Promise<void> => {
  await supabase
    .from('migration_locks')
    .delete()
    .eq('lock_type', lockKey);
};

export const WizardStateProvider = ({ children }: { children: ReactNode }) => {
  const state = useAdWizardState();
  const location = useLocation();
  const { toast } = useToast();
  const saveInProgress = useRef(false);
  const hasInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const migrationInProgress = useRef(false);

  const syncAnonymousData = async () => {
    const sessionId = localStorage.getItem('anonymous_session_id');
    if (!sessionId || migrationInProgress.current) return;

    try {
      migrationInProgress.current = true;
      console.log('[Migration] Starting migration process');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[Migration] No authenticated user found');
        return;
      }

      // Get anonymous data first to validate structure
      const { data: anonymousData, error: anonymousError } = await supabase
        .from('anonymous_usage')
        .select('wizard_data')
        .eq('session_id', sessionId)
        .single();

      if (anonymousError) {
        console.error('[Migration] Error fetching anonymous data:', anonymousError);
        throw anonymousError;
      }

      console.log('[Migration] Retrieved anonymous data:', anonymousData);

      // Validate data structure
      if (!anonymousData?.wizard_data) {
        console.error('[Migration] Invalid anonymous data structure:', anonymousData);
        throw new Error('Invalid anonymous data structure');
      }

      // Log each expected field
      console.log('[Migration] Data validation:', {
        hasBusinessIdea: !!anonymousData.wizard_data[FIELD_MAPPING.businessIdea],
        hasTargetAudience: !!anonymousData.wizard_data[FIELD_MAPPING.targetAudience],
        hasAudienceAnalysis: !!anonymousData.wizard_data[FIELD_MAPPING.audienceAnalysis],
        hasCurrentStep: !!anonymousData.wizard_data[FIELD_MAPPING.currentStep],
        currentStep: anonymousData.wizard_data[FIELD_MAPPING.currentStep],
        hasSelectedHooks: Array.isArray(anonymousData.wizard_data[FIELD_MAPPING.selectedHooks]),
        hasGeneratedAds: Array.isArray(anonymousData.wizard_data[FIELD_MAPPING.generatedAds]),
      });

      // Prepare wizard data with correct field mapping
      const wizardData = {
        [FIELD_MAPPING.businessIdea]: state.businessIdea,
        [FIELD_MAPPING.targetAudience]: state.targetAudience,
        [FIELD_MAPPING.audienceAnalysis]: state.audienceAnalysis,
        [FIELD_MAPPING.currentStep]: state.currentStep,
        [FIELD_MAPPING.selectedHooks]: state.selectedHooks,
        [FIELD_MAPPING.generatedAds]: state.generatedAds,
        [FIELD_MAPPING.adFormat]: state.adFormat,
        [FIELD_MAPPING.videoAdPreferences]: state.videoAdPreferences,
      };

      console.log('[Migration] Prepared wizard data:', wizardData);

      const { data: migratedData, error } = await supabase.rpc(
        'migrate_wizard_data',
        {
          p_user_id: user.id,
          p_session_id: sessionId,
          p_wizard_data: wizardData
        }
      );

      if (error) {
        console.error('[Migration] Error during migration:', error);
        throw error;
      }

      if (migratedData && typeof migratedData === 'object') {
        console.log('[Migration] Successfully migrated data:', migratedData);
        
        // Type assertion for migratedData
        const typedData = migratedData as {
          business_idea?: BusinessIdea;
          target_audience?: TargetAudience;
          audience_analysis?: AudienceAnalysis;
          current_step?: number;
        };
        
        if (typedData.business_idea) {
          state.setBusinessIdea(typedData.business_idea);
        }
        if (typedData.target_audience) {
          state.setTargetAudience(typedData.target_audience);
        }
        if (typedData.audience_analysis) {
          state.setAudienceAnalysis(typedData.audience_analysis);
        }
        if (typedData.current_step && typedData.current_step > 1) {
          state.setCurrentStep(typedData.current_step);
        }

        localStorage.removeItem('anonymous_session_id');
        
        toast({
          title: "Progress Restored",
          description: "Your previous work has been saved to your account.",
        });
      }
    } catch (error) {
      console.error('[Migration] Migration error:', error);
      toast({
        title: "Migration Error",
        description: "There was an error migrating your progress. You may need to start over.",
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
    if (await acquireLock(lockKey)) {
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
