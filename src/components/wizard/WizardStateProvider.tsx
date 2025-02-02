import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { BusinessIdea, TargetAudience, AudienceAnalysis } from '@/types/adWizard';
import { useProjectWizardState } from '@/hooks/useProjectWizardState';
import { useLocation } from 'react-router-dom';

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
  isMigrating: boolean;
  setIsMigrating: (migrating: boolean) => void;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export const WizardStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [businessIdea, setBusinessIdeaState] = useState<BusinessIdea | null>(null);
  const [targetAudience, setTargetAudienceState] = useState<TargetAudience | null>(null);
  const [audienceAnalysis, setAudienceAnalysisState] = useState<AudienceAnalysis | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  
  const { saveToProject } = useProjectWizardState();
  const location = useLocation();

  useEffect(() => {
    // Only reset state if explicitly on new wizard and not during migration
    if (location.pathname.includes('/ad-wizard/new') && !isMigrating) {
      setCurrentStep(1);
      setBusinessIdeaState(null);
      setTargetAudienceState(null);
      setAudienceAnalysisState(null);
    }
  }, [location.pathname, isMigrating]);

  const setBusinessIdea = useCallback((idea: BusinessIdea) => {
    setBusinessIdeaState(idea);
    saveToProject({ businessIdea: idea, currentStep });
  }, [currentStep, saveToProject]);

  const setTargetAudience = useCallback((audience: TargetAudience) => {
    setTargetAudienceState(audience);
    saveToProject({ targetAudience: audience, currentStep });
  }, [currentStep, saveToProject]);

  const setAudienceAnalysis = useCallback((analysis: AudienceAnalysis) => {
    setAudienceAnalysisState(analysis);
    saveToProject({ audienceAnalysis: analysis, currentStep });
  }, [currentStep, saveToProject]);

  const handleBack = useCallback(() => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  }, []);

  const handleStartOver = useCallback(() => {
    if (location.pathname.includes('/ad-wizard/new')) {
      setCurrentStep(1);
      setBusinessIdeaState(null);
      setTargetAudienceState(null);
      setAudienceAnalysisState(null);
    }
  }, [location.pathname]);

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
        isMigrating,
        setIsMigrating
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