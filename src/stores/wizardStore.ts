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

// Helper function to deep clone objects for persistence
const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }

  const cloned = {} as T;
  Object.entries(obj).forEach(([key, value]) => {
    (cloned as any)[key] = deepClone(value);
  });

  return cloned;
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      businessIdea: null,
      targetAudience: null,
      audienceAnalysis: null,
      selectedHooks: [],
      
      setCurrentStep: (step) => set({ currentStep: step }),
      setBusinessIdea: (idea) => set({ businessIdea: deepClone(idea) }),
      setTargetAudience: (audience) => set({ targetAudience: deepClone(audience) }),
      setAudienceAnalysis: (analysis) => set({ audienceAnalysis: deepClone(analysis) }),
      setSelectedHooks: (hooks) => set({ selectedHooks: deepClone(hooks) }),
      
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
        businessIdea: deepClone(state.businessIdea),
        targetAudience: deepClone(state.targetAudience),
        audienceAnalysis: deepClone(state.audienceAnalysis),
        selectedHooks: deepClone(state.selectedHooks)
      }),
      // Ensure proper parsing of stored data
      merge: (persistedState: any, currentState: WizardState) => ({
        ...currentState,
        ...deepClone(persistedState)
      })
    }
  )
);