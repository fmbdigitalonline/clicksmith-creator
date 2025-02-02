import React, { createContext, useContext, useCallback } from 'react';
import { useWizardStore } from '@/stores/wizardStore';
import { useWizardOptimization } from '@/hooks/useWizardOptimization';
import { useToast } from '@/components/ui/use-toast';

const WizardStateContext = createContext<any>(null);

export const WizardStateProvider = ({ children }: { children: React.ReactNode }) => {
  const {
    currentStep,
    businessIdea,
    targetAudience,
    audienceAnalysis,
    setCurrentStep,
    setBusinessIdea,
    setTargetAudience,
    setAudienceAnalysis
  } = useWizardStore();

  const { toast } = useToast();

  const {
    canProceed,
    wizardProgress,
    isLoadingProgress,
    saveProgress
  } = useWizardOptimization(currentStep, businessIdea, targetAudience, audienceAnalysis);

  const handleStepChange = useCallback(async (step: number) => {
    if (step > currentStep && !canProceed) {
      toast({
        title: "Cannot Proceed",
        description: "Please complete all required fields before proceeding.",
        variant: "destructive",
      });
      return;
    }

    try {
      await saveProgress();
      setCurrentStep(step);
    } catch (error) {
      console.error('Error saving progress:', error);
      toast({
        title: "Error",
        description: "Failed to save your progress. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentStep, canProceed, saveProgress, setCurrentStep, toast]);

  const value = {
    currentStep,
    businessIdea,
    targetAudience,
    audienceAnalysis,
    setBusinessIdea,
    setTargetAudience,
    setAudienceAnalysis,
    handleStepChange,
    canNavigateToStep: canProceed,
    isLoading: isLoadingProgress,
    wizardProgress
  };

  return (
    <WizardStateContext.Provider value={value}>
      {children}
    </WizardStateContext.Provider>
  );
};

export const useWizardState = () => {
  const context = useContext(WizardStateContext);
  if (!context) {
    throw new Error('useWizardState must be used within a WizardStateProvider');
  }
  return context;
};