import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BusinessIdea, TargetAudience, AudienceAnalysis, AdHook } from '@/types/adWizard';
import { saveWizardProgress } from '@/utils/wizardProgress';
import { useEffect } from 'react';

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
  hydrateFromUrl: () => void;
  syncWithUrl: () => void;
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      businessIdea: null,
      targetAudience: null,
      audienceAnalysis: null,
      selectedHooks: [],
      
      setCurrentStep: (step) => {
        set({ currentStep: step });
        get().syncWithUrl();
      },
      
      setBusinessIdea: (idea) => {
        set({ businessIdea: idea });
        get().syncWithUrl();
      },
      
      setTargetAudience: (audience) => {
        set({ targetAudience: audience });
        get().syncWithUrl();
      },
      
      setAudienceAnalysis: (analysis) => {
        set({ audienceAnalysis: analysis });
        get().syncWithUrl();
      },
      
      setSelectedHooks: (hooks) => {
        set({ selectedHooks: hooks });
        get().syncWithUrl();
      },
      
      handleBack: () => {
        const { currentStep } = get();
        set({ currentStep: Math.max(1, currentStep - 1) });
        get().syncWithUrl();
      },
      
      handleStartOver: () => {
        set({
          currentStep: 1,
          businessIdea: null,
          targetAudience: null,
          audienceAnalysis: null,
          selectedHooks: []
        });
        get().syncWithUrl();
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
      },

      hydrateFromUrl: () => {
        const params = new URLSearchParams(window.location.search);
        const step = parseInt(params.get('step') || '1');
        if (get().canNavigateToStep(step)) {
          set({ currentStep: step });
        }
      },

      syncWithUrl: () => {
        const { currentStep } = get();
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('step', currentStep.toString());
        window.history.replaceState({}, '', currentUrl.toString());
      }
    }),
    {
      name: 'wizard-storage',
      partialize: (state) => ({
        businessIdea: state.businessIdea,
        targetAudience: state.targetAudience,
        audienceAnalysis: state.audienceAnalysis,
        selectedHooks: state.selectedHooks,
        currentStep: state.currentStep
      })
    }
  )
);

// Hook for handling URL synchronization
export const useWizardUrlSync = () => {
  const store = useWizardStore();

  useEffect(() => {
    // Hydrate state from URL on mount
    store.hydrateFromUrl();
    
    // Listen for popstate events (browser back/forward)
    const handlePopState = () => {
      store.hydrateFromUrl();
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return null;
};
