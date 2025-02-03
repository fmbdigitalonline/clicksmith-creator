import { create } from 'zustand';
import { BusinessIdea, TargetAudience, AudienceAnalysis, AdHook } from '@/types/adWizard';
import { persist } from 'zustand/middleware';

interface WizardState {
  currentStep: number;
  businessIdea: BusinessIdea | null;
  targetAudience: TargetAudience | null;
  audienceAnalysis: AudienceAnalysis | null;
  selectedHooks: AdHook[];
  setCurrentStep: (step: number) => void;
  setBusinessIdea: (idea: BusinessIdea) => void;
  setTargetAudience: (audience: TargetAudience) => void;
  setAudienceAnalysis: (analysis: AudienceAnalysis) => void;
  setSelectedHooks: (hooks: AdHook[]) => void;
  handleBack: () => void;
  handleStartOver: () => void;
  canNavigateToStep: (step: number) => boolean;
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      businessIdea: null,
      targetAudience: null,
      audienceAnalysis: null,
      selectedHooks: [],
      
      setCurrentStep: (step) => set({ currentStep: step }),
      setBusinessIdea: (idea) => set({ businessIdea: idea }),
      setTargetAudience: (audience) => set({ targetAudience: audience }),
      setAudienceAnalysis: (analysis) => set({ audienceAnalysis: analysis }),
      setSelectedHooks: (hooks) => set({ selectedHooks: hooks }),
      
      handleBack: () => {
        const { currentStep } = get();
        set({ currentStep: Math.max(1, currentStep - 1) });
      },
      
      handleStartOver: () => {
        set({
          currentStep: 1,
          businessIdea: null,
          targetAudience: null,
          audienceAnalysis: null,
          selectedHooks: []
        });
      },
      
      canNavigateToStep: (step) => {
        const { businessIdea, targetAudience, audienceAnalysis } = get();
        switch (step) {
          case 1: return true;
          case 2: return !!businessIdea;
          case 3: return !!businessIdea && !!targetAudience;
          case 4: return !!businessIdea && !!targetAudience && !!audienceAnalysis;
          default: return false;
        }
      }
    }),
    {
      name: 'wizard-storage',
      partialize: (state) => ({
        currentStep: state.currentStep,
        businessIdea: state.businessIdea,
        targetAudience: state.targetAudience,
        audienceAnalysis: state.audienceAnalysis,
        selectedHooks: state.selectedHooks
      })
    }
  )
);