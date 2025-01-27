import { createContext, useContext, ReactNode, useEffect, useRef, useState } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
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
  const saveQueue = useRef<Promise<any>>(Promise.resolve());
  const isSaving = useRef(false);
  const hasInitialized = useRef(false);
  const retryCount = useRef(0);
  const MAX_RETRIES = 3;

  const queueSave = async (data: Partial<WizardData>) => {
    if (isSaving.current) {
      console.log('[WizardStateProvider] Save already in progress, queueing...');
      await saveQueue.current;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    isSaving.current = true;
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const saveData = {
          ...data,
          user_id: user.id
        };
        
        let success = false;
        while (!success && retryCount.current < MAX_RETRIES) {
          try {
            const result = await saveWizardState(saveData, stateVersion);
            if (result.success) {
              setStateVersion(result.newVersion);
              success = true;
              retryCount.current = 0;
            }
          } catch (error: any) {
            retryCount.current++;
            if (error.message === 'Concurrent save detected' && retryCount.current < MAX_RETRIES) {
              console.log(`[WizardStateProvider] Retry attempt ${retryCount.current}/${MAX_RETRIES}`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount.current));
              continue;
            }
            throw error;
          }
        }
      } catch (error) {
        console.error('[WizardStateProvider] Error in save queue:', error);
      } finally {
        isSaving.current = false;
      }
    });

    return saveQueue.current;
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

  const getCurrentStepFromUrl = () => {
    const match = location.pathname.match(/step-(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

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
            .maybeSingle();

          if (progress) {
            console.log('[WizardStateProvider] Found existing progress:', progress);
            
            if (progress.business_idea) state.setBusinessIdea(progress.business_idea as BusinessIdea);
            if (progress.target_audience) state.setTargetAudience(progress.target_audience as TargetAudience);
            if (progress.audience_analysis) state.setAudienceAnalysis(progress.audience_analysis as AudienceAnalysis);
            
            setStateVersion(progress.version || 1);
            
            const urlStep = getCurrentStepFromUrl();
            const targetStep = Math.max(progress.current_step || 1, urlStep || 1);
            
            if (targetStep > 1 && canNavigateToStep(targetStep)) {
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

  useEffect(() => {
    const saveProgress = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await queueSave({
          user_id: user.id,
          business_idea: state.businessIdea,
          target_audience: state.targetAudience,
          audience_analysis: state.audienceAnalysis,
          current_step: state.currentStep
        });
      }
    };

    const debounceTimeout = setTimeout(saveProgress, 1000);
    return () => clearTimeout(debounceTimeout);
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
