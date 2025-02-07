import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { BusinessIdea, TargetAudience, AudienceAnalysis } from '@/types/adWizard';
import { useWizardStore } from '@/stores/wizardStore';
import { useProjectWizardState } from '@/hooks/useProjectWizardState';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

  // Load saved progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: progress } = await supabase
          .from('wizard_progress')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (progress) {
          if (progress.business_idea) setStoreBusinessIdea(progress.business_idea);
          if (progress.target_audience) setStoreTargetAudience(progress.target_audience);
          if (progress.audience_analysis) setStoreAudienceAnalysis(progress.audience_analysis);
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
  }, []);

  // Save progress when state changes
  const saveProgress = useCallback(async (data: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('wizard_progress')
        .upsert({
          user_id: user.id,
          ...data,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      await saveToProject(data);
    } catch (error) {
      console.error('[WizardStateProvider] Error saving progress:', error);
    }
  }, [saveToProject]);

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