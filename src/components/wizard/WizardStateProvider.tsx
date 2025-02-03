import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { BusinessIdea, TargetAudience, AudienceAnalysis } from '@/types/adWizard';
import { useWizardStore } from '@/stores/wizardStore';
import { useProjectWizardState } from '@/hooks/useProjectWizardState';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isBusinessIdea, isTargetAudience, isAudienceAnalysis } from "@/utils/typeGuards";

interface WizardContextType {
  currentStep: number;
  businessIdea: BusinessIdea | null;
  targetAudience: TargetAudience | null;
  audienceAnalysis: AudienceAnalysis | null;
  setCurrentStep: (step: number) => void;
  setBusinessIdea: (idea: BusinessIdea) => void;
  setTargetAudience: (audience: TargetAudience) => void;
  setAudienceAnalysis: (analysis: AudienceAnalysis) => void;
  handleBack: () => void;
  handleStartOver: () => void;
  canNavigateToStep: (step: number) => boolean;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export const WizardStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const isMounted = useRef(true);
  const {
    currentStep,
    businessIdea,
    targetAudience,
    audienceAnalysis,
    setCurrentStep,
    setBusinessIdea: setStoreBusinessIdea,
    setTargetAudience: setStoreTargetAudience,
    setAudienceAnalysis: setStoreAudienceAnalysis,
    handleBack,
    handleStartOver,
    canNavigateToStep
  } = useWizardStore();

  const { saveToProject } = useProjectWizardState();

  // Save progress when state changes
  const saveProgress = useCallback(async (data: any) => {
    try {
      console.log('[WizardStateProvider] Saving progress:', data);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('wizard_progress')
        .upsert({
          user_id: user.id,
          ...data,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      await saveToProject(data);
      console.log('[WizardStateProvider] Progress saved successfully');
    } catch (error) {
      console.error('[WizardStateProvider] Error saving progress:', error);
    }
  }, [saveToProject]);

  // Load saved progress on mount and handle auth state changes
  useEffect(() => {
    const loadProgress = async () => {
      try {
        console.log('[WizardStateProvider] Loading progress');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: progress, error } = await supabase
          .from('wizard_progress')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (progress && isMounted.current) {
          console.log('[WizardStateProvider] Found existing progress:', progress);
          if (progress.business_idea && isBusinessIdea(progress.business_idea)) {
            setStoreBusinessIdea(progress.business_idea);
          }
          if (progress.target_audience && isTargetAudience(progress.target_audience)) {
            setStoreTargetAudience(progress.target_audience);
          }
          if (progress.audience_analysis && isAudienceAnalysis(progress.audience_analysis)) {
            setStoreAudienceAnalysis(progress.audience_analysis);
          }
          if (progress.current_step) setCurrentStep(progress.current_step);
        }
      } catch (error) {
        console.error('[WizardStateProvider] Error loading progress:', error);
        toast({
          title: "Error loading progress",
          description: "There was an error loading your progress. Please try again.",
          variant: "destructive",
        });
      }
    };

    loadProgress();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[WizardStateProvider] Auth state changed:', event);
      if (event === 'SIGNED_IN' && session?.user) {
        loadProgress();
      }
    });

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [setStoreBusinessIdea, setStoreTargetAudience, setStoreAudienceAnalysis, setCurrentStep, toast]);

  // Save progress before unmounting
  useEffect(() => {
    const saveCurrentProgress = () => {
      if (businessIdea || targetAudience || audienceAnalysis) {
        console.log('[WizardStateProvider] Saving progress before unmount');
        saveProgress({
          business_idea: businessIdea,
          target_audience: targetAudience,
          audience_analysis: audienceAnalysis,
          current_step: currentStep
        });
      }
    };

    window.addEventListener('beforeunload', saveCurrentProgress);
    return () => {
      window.removeEventListener('beforeunload', saveCurrentProgress);
      saveCurrentProgress();
    };
  }, [businessIdea, targetAudience, audienceAnalysis, currentStep, saveProgress]);

  // Wrap state setters to include persistence
  const setBusinessIdea = useCallback((idea: BusinessIdea) => {
    setStoreBusinessIdea(idea);
    saveProgress({ business_idea: idea, current_step: currentStep });
  }, [currentStep, setStoreBusinessIdea, saveProgress]);

  const setTargetAudience = useCallback((audience: TargetAudience) => {
    setStoreTargetAudience(audience);
    saveProgress({ target_audience: audience, current_step: currentStep });
  }, [currentStep, setStoreTargetAudience, saveProgress]);

  const setAudienceAnalysis = useCallback((analysis: AudienceAnalysis) => {
    setStoreAudienceAnalysis(analysis);
    saveProgress({ audience_analysis: analysis, current_step: currentStep });
  }, [currentStep, setStoreAudienceAnalysis, saveProgress]);

  return (
    <WizardContext.Provider
      value={{
        currentStep,
        businessIdea,
        targetAudience,
        audienceAnalysis,
        setCurrentStep,
        setBusinessIdea,
        setTargetAudience,
        setAudienceAnalysis,
        handleBack,
        handleStartOver,
        canNavigateToStep,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
};

export const useWizardState = () => {
  const context = useContext(WizardContext);
  if (context === undefined) {
    throw new Error('useWizardState must be used within a WizardStateProvider');
  }
  return context;
};