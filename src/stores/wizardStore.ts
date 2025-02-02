import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BusinessIdea, TargetAudience, AudienceAnalysis, AdHook } from '@/types/adWizard';
import { supabase } from '@/integrations/supabase/client';

interface WizardState {
  currentStep: number;
  businessIdea: BusinessIdea | null;
  targetAudience: TargetAudience | null;
  audienceAnalysis: AudienceAnalysis | null;
  selectedHooks: AdHook[];
  isNewSession: boolean;
  setCurrentStep: (step: number) => void;
  setBusinessIdea: (idea: BusinessIdea) => void;
  setTargetAudience: (audience: TargetAudience) => void;
  setAudienceAnalysis: (analysis: AudienceAnalysis) => void;
  setSelectedHooks: (hooks: AdHook[]) => void;
  handleBack: () => void;
  handleStartOver: () => void;
  initializeNewSession: () => void;
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      businessIdea: null,
      targetAudience: null,
      audienceAnalysis: null,
      selectedHooks: [],
      isNewSession: true,

      setCurrentStep: (step) => {
        if (step === 1 && window.location.pathname.includes('/ad-wizard/new')) {
          set({ isNewSession: true });
        }
        set({ currentStep: step });
      },

      setBusinessIdea: async (idea) => {
        set({ businessIdea: idea });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('wizard_progress')
            .upsert({
              user_id: user.id,
              business_idea: idea,
              current_step: get().currentStep,
              version: 1
            });
        }
      },

      setTargetAudience: async (audience) => {
        set({ targetAudience: audience });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('wizard_progress')
            .upsert({
              user_id: user.id,
              target_audience: audience,
              current_step: get().currentStep,
              version: 1
            });
        }
      },

      setAudienceAnalysis: async (analysis) => {
        set({ audienceAnalysis: analysis });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('wizard_progress')
            .upsert({
              user_id: user.id,
              audience_analysis: analysis,
              current_step: get().currentStep,
              version: 1
            });
        }
      },

      setSelectedHooks: (hooks) => set({ selectedHooks: hooks }),

      handleBack: () => set((state) => ({ 
        currentStep: Math.max(1, state.currentStep - 1),
        isNewSession: false 
      })),

      handleStartOver: () => {
        if (window.location.pathname.includes('/ad-wizard/new')) {
          set({
            currentStep: 1,
            businessIdea: null,
            targetAudience: null,
            audienceAnalysis: null,
            selectedHooks: [],
            isNewSession: true
          });
        }
      },

      initializeNewSession: () => {
        if (window.location.pathname.includes('/ad-wizard/new')) {
          set({
            currentStep: 1,
            businessIdea: null,
            targetAudience: null,
            audienceAnalysis: null,
            selectedHooks: [],
            isNewSession: true
          });
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
        selectedHooks: state.selectedHooks,
        isNewSession: state.isNewSession
      }),
      skipHydration: window.location.pathname.includes('/ad-wizard/new')
    }
  )
);