import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { BusinessIdea, TargetAudience, AudienceAnalysis } from '@/types/adWizard';
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
  const [currentStep, setCurrentStep] = useState(1);
  const [businessIdea, setBusinessIdeaState] = useState<BusinessIdea | null>(null);
  const [targetAudience, setTargetAudienceState] = useState<TargetAudience | null>(null);
  const [audienceAnalysis, setAudienceAnalysisState] = useState<AudienceAnalysis | null>(null);
  const { toast } = useToast();
  
  const { saveToProject } = useProjectWizardState();

  // Load saved progress when component mounts
  useEffect(() => {
    const loadSavedProgress = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: progress, error } = await supabase
          .from('wizard_progress')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (progress) {
          if (progress.business_idea) setBusinessIdeaState(progress.business_idea);
          if (progress.target_audience) setTargetAudienceState(progress.target_audience);
          if (progress.audience_analysis) setAudienceAnalysisState(progress.audience_analysis);
          if (progress.current_step) setCurrentStep(progress.current_step);
        }
      } catch (error) {
        console.error('Error loading wizard progress:', error);
      }
    };

    loadSavedProgress();
  }, []);

  const saveProgress = async (data: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('wizard_progress')
        .upsert({
          user_id: user.id,
          ...data,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving wizard progress:', error);
      toast({
        title: "Error saving progress",
        description: "Your progress couldn't be saved. Please try again.",
        variant: "destructive",
      });
    }
  };

  const setBusinessIdea = useCallback((idea: BusinessIdea) => {
    setBusinessIdeaState(idea);
    saveProgress({ business_idea: idea, current_step: currentStep });
  }, [currentStep]);

  const setTargetAudience = useCallback((audience: TargetAudience) => {
    setTargetAudienceState(audience);
    saveProgress({ target_audience: audience, current_step: currentStep });
  }, [currentStep]);

  const setAudienceAnalysis = useCallback((analysis: AudienceAnalysis) => {
    setAudienceAnalysisState(analysis);
    saveProgress({ audience_analysis: analysis, current_step: currentStep });
  }, [currentStep]);

  const handleBack = useCallback(() => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  }, []);

  const handleStartOver = useCallback(() => {
    setCurrentStep(1);
    setBusinessIdeaState(null);
    setTargetAudienceState(null);
    setAudienceAnalysisState(null);
    saveProgress({
      business_idea: null,
      target_audience: null,
      audience_analysis: null,
      current_step: 1
    });
  }, []);

  const canNavigateToStep = useCallback((step: number): boolean => {
    switch (step) {
      case 1: return true;
      case 2: return !!businessIdea;
      case 3: return !!businessIdea && !!targetAudience;
      case 4: return !!businessIdea && !!targetAudience && !!audienceAnalysis;
      default: return false;
    }
  }, [businessIdea, targetAudience, audienceAnalysis]);

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