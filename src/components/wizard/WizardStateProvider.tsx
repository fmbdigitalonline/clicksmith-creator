import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BusinessIdea, TargetAudience, AudienceAnalysis, Step } from '@/types/adWizard';
import { useAuth } from '@/hooks/useAuth.ts';
import { saveQueue } from '@/utils/saveQueue';
import { WizardData } from '@/types/wizardProgress';

interface WizardContextType {
  businessIdea: BusinessIdea | null;
  targetAudience: TargetAudience | null;
  audienceAnalysis: AudienceAnalysis | null;
  currentStep: Step;
  setBusinessIdea: (idea: BusinessIdea) => void;
  setTargetAudience: (audience: TargetAudience) => void;
  setAudienceAnalysis: (analysis: AudienceAnalysis) => void;
  setCurrentStep: (step: Step) => void;
  isLoading: boolean;
  canNavigateToStep: (step: number) => boolean;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export const WizardStateProvider = ({ children }: { children: React.ReactNode }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [businessIdea, setStoreBusinessIdea] = useState<BusinessIdea | null>(null);
  const [targetAudience, setStoreTargetAudience] = useState<TargetAudience | null>(null);
  const [audienceAnalysis, setStoreAudienceAnalysis] = useState<AudienceAnalysis | null>(null);
  const [currentStep, setStoreCurrentStep] = useState<Step>('idea');
  const [isLoading, setIsLoading] = useState(false);
  const saveInProgress = useRef<Promise<void>>();
  const retryCount = useRef(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  const logAnalytics = async (eventName: string, properties?: Record<string, any>) => {
    try {
      if (typeof window !== 'undefined' && (window as any).posthog) {
        await (window as any).posthog.capture(eventName, properties);
      }
    } catch (error) {
      console.warn('Analytics error:', error);
    }
  };

  const canNavigateToStep = useCallback((step: number): boolean => {
    switch (step) {
      case 1:
        return true;
      case 2:
        return !!businessIdea;
      case 3:
        return !!businessIdea && !!targetAudience;
      case 4:
        return !!businessIdea && !!targetAudience && !!audienceAnalysis;
      default:
        return false;
    }
  }, [businessIdea, targetAudience, audienceAnalysis]);

  const saveProgress = useCallback(async (data: Partial<WizardData>) => {
    if (!user) return;

    const save = async () => {
      try {
        setIsLoading(true);

        const { data: current, error: fetchError } = await supabase
          .from('wizard_progress')
          .select('version')
          .eq('user_id', user.id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        const currentVersion = current?.version || 0;
        const newVersion = currentVersion + 1;

        const { error } = await supabase
          .from('wizard_progress')
          .upsert({
            user_id: user.id,
            ...data,
            version: newVersion,
            updated_at: new Date().toISOString()
          })
          .match({ user_id: user.id, version: currentVersion });

        if (error) {
          if (error.message.includes('Concurrent save detected') && retryCount.current < MAX_RETRIES) {
            retryCount.current++;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount.current));
            return save();
          }
          throw error;
        }

        retryCount.current = 0;
        
        logAnalytics('wizard_progress_saved', {
          step: data.current_step,
          retries: retryCount.current
        }).catch(() => {});
        
      } catch (error) {
        console.error('Error saving progress:', error);
        toast({
          title: "Error saving progress",
          description: "Your changes may not be saved. Please try again.",
          variant: "destructive",
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    };

    return saveQueue.add(save);
  }, [user, toast]);

  // Load initial state
  useEffect(() => {
    const loadInitialState = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('wizard_progress')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          if (data.business_idea) setStoreBusinessIdea(data.business_idea);
          if (data.target_audience) setStoreTargetAudience(data.target_audience);
          if (data.audience_analysis) setStoreAudienceAnalysis(data.audience_analysis);
          if (data.current_step) setStoreCurrentStep(data.current_step as Step);
        }
      } catch (error) {
        console.error('Error loading initial state:', error);
        toast({
          title: "Error loading data",
          description: "Failed to load your previous progress.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialState();
  }, [user, toast]);

  // Save state changes
  useEffect(() => {
    if (!businessIdea && !targetAudience && !audienceAnalysis) return;

    const saveState = async () => {
      try {
        await saveProgress({
          business_idea: businessIdea,
          target_audience: targetAudience,
          audience_analysis: audienceAnalysis,
          current_step: currentStep
        });
      } catch (error) {
        // Error is already handled in saveProgress
        console.error('Error in save effect:', error);
      }
    };

    saveState();
  }, [businessIdea, targetAudience, audienceAnalysis, currentStep, saveProgress, toast]);

  const setBusinessIdea = useCallback((idea: BusinessIdea) => {
    setStoreBusinessIdea(idea);
    const promise = saveProgress({ business_idea: idea });
    saveInProgress.current = promise;
  }, [saveProgress]);

  const setTargetAudience = useCallback((audience: TargetAudience) => {
    setStoreTargetAudience(audience);
    const promise = saveProgress({ target_audience: audience });
    saveInProgress.current = promise;
  }, [saveProgress]);

  const setAudienceAnalysis = useCallback((analysis: AudienceAnalysis) => {
    setStoreAudienceAnalysis(analysis);
    const promise = saveProgress({ audience_analysis: analysis });
    saveInProgress.current = promise;
  }, [saveProgress]);

  const setCurrentStep = useCallback((step: Step) => {
    setStoreCurrentStep(step);
    const promise = saveProgress({ current_step: step });
    saveInProgress.current = promise;
  }, [saveProgress]);

  // Cleanup function
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (saveInProgress.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <WizardContext.Provider
      value={{
        businessIdea,
        targetAudience,
        audienceAnalysis,
        currentStep,
        setBusinessIdea,
        setTargetAudience,
        setAudienceAnalysis,
        setCurrentStep,
        isLoading,
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