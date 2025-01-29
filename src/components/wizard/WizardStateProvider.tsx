import { createContext, useContext, ReactNode, useEffect, useRef, useState } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { useLocation, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [stateVersion, setStateVersion] = useState(1);
  const isSaving = useRef(false);
  const hasInitialized = useRef(false);
  const saveQueue = useRef<Array<Partial<WizardData>>>([]);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const migrationInProgress = useRef(false);

  const processQueue = async () => {
    if (isSaving.current || saveQueue.current.length === 0) return;

    isSaving.current = true;
    console.log('[WizardStateProvider] Processing save queue, items:', saveQueue.current.length);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const nextSave = saveQueue.current[0];

      if (!user) {
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          const completeData = {
            ...nextSave,
            business_idea: state.businessIdea,
            target_audience: state.targetAudience,
            audience_analysis: state.audienceAnalysis,
            generated_ads: state.generatedAds || [],
            current_step: state.currentStep,
            last_save_attempt: new Date().toISOString(),
            version: stateVersion
          };

          const { error } = await supabase
            .from('anonymous_usage')
            .update({
              wizard_data: completeData,
              last_completed_step: state.currentStep,
              last_save_attempt: new Date().toISOString()
            })
            .eq('session_id', sessionId);

          if (error) throw error;
        }
      } else {
        const saveData = {
          ...nextSave,
          user_id: user.id,
          last_save_attempt: new Date().toISOString(),
          current_step: state.currentStep,
          business_idea: state.businessIdea,
          target_audience: state.targetAudience,
          audience_analysis: state.audienceAnalysis,
          generated_ads: state.generatedAds || [],
          selected_hooks: state.selectedHooks || []
        };

        const result = await saveWizardState(saveData, stateVersion);
        if (result.success) {
          setStateVersion(result.newVersion);
        }
      }

      saveQueue.current.shift();

    } catch (error) {
      console.error('[WizardStateProvider] Error processing save queue:', error);
      toast({
        title: "Save Error",
        description: "Failed to save changes. Your progress may be lost.",
        variant: "destructive",
      });
    } finally {
      isSaving.current = false;
      if (saveQueue.current.length > 0) {
        setTimeout(processQueue, 1500);
      }
    }
  };

  const queueSave = (data: Partial<WizardData>) => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    const completeData = {
      ...data,
      business_idea: state.businessIdea,
      target_audience: state.targetAudience,
      audience_analysis: state.audienceAnalysis,
      generated_ads: state.generatedAds || [],
      current_step: state.currentStep
    };

    saveQueue.current.push(completeData);

    saveTimeout.current = setTimeout(() => {
      processQueue();
    }, 1000);
  };

  const syncWizardState = async (userId: string | undefined) => {
    if (migrationInProgress.current) {
      console.log('[WizardStateProvider] Migration already in progress, skipping');
      return;
    }

    try {
      setIsLoading(true);
      migrationInProgress.current = true;

      if (userId) {
        const { data: progress } = await supabase
          .from('wizard_progress')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId && !progress) {
          const { data: anonymousData } = await supabase
            .from('anonymous_usage')
            .select('wizard_data, last_completed_step')
            .eq('session_id', sessionId)
            .maybeSingle();

          if (anonymousData?.wizard_data) {
            const calculatedStep = Math.max(
              anonymousData.last_completed_step || 1,
              1
            );

            const { data: migratedData, error } = await supabase
              .rpc('atomic_migration', {
                p_user_id: userId,
                p_session_id: sessionId,
                p_calculated_step: calculatedStep
              });

            if (error) throw error;

            if (migratedData) {
              if (migratedData.business_idea && isBusinessIdea(migratedData.business_idea)) {
                state.setBusinessIdea(migratedData.business_idea);
              }
              if (migratedData.target_audience && isTargetAudience(migratedData.target_audience)) {
                state.setTargetAudience(migratedData.target_audience);
              }
              if (migratedData.audience_analysis && isAudienceAnalysis(migratedData.audience_analysis)) {
                state.setAudienceAnalysis(migratedData.audience_analysis);
              }
              state.setCurrentStep(Math.max(migratedData.current_step || 1, 1));
              setStateVersion(migratedData.version || 1);
              navigate(`/ad-wizard/step-${migratedData.current_step || 1}`, { replace: true });
            }
          }
        }
      }
    } catch (error) {
      console.error('[WizardStateProvider] Error syncing state:', error);
    } finally {
      setIsLoading(false);
      migrationInProgress.current = false;
    }
  };

  useEffect(() => {
    const unsubscribe = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[WizardStateProvider] Auth state changed:', event);

      if (session?.user && !hasInitialized.current) {
        await syncWizardState(session.user.id);
      }
    });

    return () => {
      if (unsubscribe?.data?.subscription) {
        unsubscribe.data.subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    const initializeState = async () => {
      console.log('[WizardStateProvider] Initializing wizard...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!hasInitialized.current) {
        console.log('[WizardStateProvider] Syncing wizard state for user:', user?.id);
        await syncWizardState(user?.id);
      }
    };

    initializeState();
  }, []);

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

export default WizardStateProvider;
