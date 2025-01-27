import { createContext, useContext, ReactNode, useEffect, useRef, useState } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { useLocation } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";

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

export const WizardStateProvider = ({ children }: { children: ReactNode }) => {
  const state = useAdWizardState();
  const location = useLocation();
  const { toast } = useToast();
  const saveInProgress = useRef(false);
  const hasInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const currentVersion = useRef(1);
  const saveTimeout = useRef<NodeJS.Timeout>();
  const retryCount = useRef(0);
  const MAX_RETRIES = 3;

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

  const saveProgress = async () => {
    if (saveInProgress.current) {
      console.log('[WizardStateProvider] Save already in progress, skipping');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('[WizardStateProvider] No authenticated user, skipping save');
      setIsLoading(false);
      return;
    }

    try {
      saveInProgress.current = true;
      console.log('[WizardStateProvider] Starting to save progress');

      // Get the current progress first
      const { data: existingProgress, error: fetchError } = await supabase
        .from('wizard_progress')
        .select('version')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      const nextVersion = (existingProgress?.version || 0) + 1;
      currentVersion.current = nextVersion;

      const { error } = await supabase
        .from('wizard_progress')
        .upsert({
          user_id: user.id,
          business_idea: state.businessIdea,
          target_audience: state.targetAudience,
          audience_analysis: state.audienceAnalysis,
          current_step: state.currentStep,
          version: nextVersion,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        if (error.message.includes('Concurrent save detected') && retryCount.current < MAX_RETRIES) {
          retryCount.current++;
          const delay = Math.min(1000 * Math.pow(2, retryCount.current), 8000);
          console.log(`[WizardStateProvider] Concurrent save detected, retrying in ${delay}ms (attempt ${retryCount.current})`);
          setTimeout(() => saveProgress(), delay);
          return;
        }
        throw error;
      }

      retryCount.current = 0;
      console.log('[WizardStateProvider] Progress saved successfully');

    } catch (error) {
      console.error('[WizardStateProvider] Error saving progress:', error);
      toast({
        title: "Error Saving Progress",
        description: "There was an error saving your progress. Your changes may not be saved.",
        variant: "destructive",
      });
    } finally {
      saveInProgress.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasInitialized.current) {
      setIsLoading(false);
      hasInitialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(() => {
      saveProgress();
    }, 2000);

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