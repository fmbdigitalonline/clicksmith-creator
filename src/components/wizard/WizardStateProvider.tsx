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

      if (migratedData) {
        console.log('[Migration] Successfully migrated data:', migratedData);
        
        // Update local state with migrated data
        if (migratedData.business_idea) {
          state.setBusinessIdea(migratedData.business_idea);
        }
        if (migratedData.target_audience) {
          state.setTargetAudience(migratedData.target_audience);
        }
        if (migratedData.audience_analysis) {
          state.setAudienceAnalysis(migratedData.audience_analysis);
        }
        if (migratedData.current_step > 1) {
          state.setCurrentStep(migratedData.current_step);
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
