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
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const migrationInProgress = useRef(false);

  const calculateHighestStep = (data: WizardData): number => {
    let step = 1;
    if (data.business_idea) step = Math.max(step, 2);
    if (data.target_audience) step = Math.max(step, 3);
    if (data.audience_analysis) step = Math.max(step, 4);
    return step;
  };

  const queueSave = async (data: Partial<WizardData>) => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    if (isSaving.current) {
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const sessionId = localStorage.getItem('anonymous_session_id');
      if (sessionId) {
        try {
          const completeData = {
            ...data,
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
              last_save_attempt: new Date().toISOString(),
              save_count: 0
            })
            .eq('session_id', sessionId);

          if (error) throw error;
        } catch (error) {
          console.error('[WizardStateProvider] Error saving anonymous state:', error);
          toast({
            title: "Save Error",
            description: "Failed to save your progress. Please try again.",
            variant: "destructive",
          });
        }
      }
      return;
    }

    isSaving.current = true;

    try {
      const saveData = {
        ...data,
        user_id: user.id,
        last_save_attempt: new Date().toISOString(),
        current_step: state.currentStep,
        business_idea: state.businessIdea,
        target_audience: state.targetAudience,
        audience_analysis: state.audienceAnalysis,
        generated_ads: state.generatedAds || []
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

  const syncWizardState = async (userId: string | undefined) => {
    if (migrationInProgress.current) {
      console.log('[WizardStateProvider] Migration already in progress, skipping');
      return;
    }

    try {
      console.log('[WizardStateProvider] Starting to sync wizard state for user:', userId);
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
          console.log('[WizardStateProvider] Found anonymous session:', sessionId);
          const { data: anonymousData } = await supabase
            .from('anonymous_usage')
            .select('wizard_data, last_completed_step')
            .eq('session_id', sessionId)
            .maybeSingle();

          if (anonymousData?.wizard_data) {
            console.log('[WizardStateProvider] Found anonymous data:', anonymousData);
            try {
              const calculatedStep = Math.max(
                calculateHighestStep(anonymousData.wizard_data as WizardData),
                anonymousData.last_completed_step || 1
              );

              const { data: migratedData, error } = await supabase
                .rpc('atomic_migration', {
                  p_user_id: userId,
                  p_session_id: sessionId,
                  p_calculated_step: calculatedStep
                });

              if (error) {
                console.error('[WizardStateProvider] Migration error:', error);
                throw error;
              }

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
                  calculatedStep
                );
                
                state.setCurrentStep(targetStep);
                setStateVersion(migratedData.version || 1);
                
                if (targetStep > 1) {
                  navigate(`/ad-wizard/step-${targetStep}`, { replace: true });
                }
                
                localStorage.removeItem('anonymous_session_id');
                
                toast({
                  title: "Progress Restored",
                  description: "Your previous work has been saved to your account.",
                });
              }
            } catch (error) {
              console.error('[WizardStateProvider] Error during migration:', error);
              toast({
                title: "Migration Error",
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
            if (progress.current_step > 1 && location.pathname === '/ad-wizard/new') {
              navigate(`/ad-wizard/step-${progress.current_step}`, { replace: true });
            }
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
            current_step: state.currentStep,
            generated_ads: state.generatedAds || []
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
  }, [state.businessIdea, state.targetAudience, state.audienceAnalysis, state.currentStep, state.generatedAds]);

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
