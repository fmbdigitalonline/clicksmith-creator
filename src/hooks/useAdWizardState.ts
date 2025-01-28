import { useState, Dispatch, SetStateAction } from 'react';
import { BusinessIdea, TargetAudience, AudienceAnalysis, AdHook } from '@/types/adWizard';

export const useAdWizardState = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [businessIdea, setBusinessIdea] = useState<BusinessIdea | null>(null);
  const [targetAudience, setTargetAudience] = useState<TargetAudience | null>(null);
  const [audienceAnalysis, setAudienceAnalysis] = useState<AudienceAnalysis | null>(null);
  const [selectedHooks, setSelectedHooks] = useState<AdHook[]>([]);
  const [generatedAds, setGeneratedAds] = useState<any[]>([]);

  return {
    currentStep,
    setCurrentStep,
    businessIdea,
    setBusinessIdea,
    targetAudience,
    setTargetAudience,
    audienceAnalysis,
    setAudienceAnalysis,
    selectedHooks,
    setSelectedHooks,
    generatedAds,
    setGeneratedAds
  };
};