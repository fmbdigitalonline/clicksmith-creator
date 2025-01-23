import { useState, useCallback, useEffect } from "react";
import {
  BusinessIdea,
  TargetAudience,
  AudienceAnalysis,
  AdHook,
  WizardProgress,
  AnonymousWizardData
} from "@/types/adWizard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "react-router-dom";
import { saveWizardProgress, clearWizardProgress } from "@/utils/wizardProgress";

export const useAdWizardState = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [businessIdea, setBusinessIdea] = useState<BusinessIdea | null>(null);
  const [targetAudience, setTargetAudience] = useState<TargetAudience | null>(null);
  const [audienceAnalysis, setAudienceAnalysis] = useState<AudienceAnalysis | null>(null);
  const [selectedHooks, setSelectedHooks] = useState<AdHook[]>([]);
  const { toast } = useToast();
  const { projectId } = useParams();

  useEffect(() => {
    const loadSavedProgress = async () => {
      try {
        console.log('[useAdWizardState] Starting to load progress');
        const { data: { user } } = await supabase.auth.getUser();
        
        // For new projects, clear any existing progress and start from step 1
        if (projectId === 'new') {
          if (user) {
            await clearWizardProgress(projectId, user.id);
          }
          setBusinessIdea(null);
          setTargetAudience(null);
          setAudienceAnalysis(null);
          setSelectedHooks([]);
          setCurrentStep(1);
          return;
        }

        // Try to load from project if we have a project ID
        if (projectId) {
          const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .maybeSingle();

          if (projectError) {
            console.error('[useAdWizardState] Error loading project:', projectError);
            toast({
              title: "Couldn't load project",
              description: "We had trouble loading your project. Starting fresh.",
              variant: "destructive",
            });
            return;
          }

          if (project) {
            console.log('[useAdWizardState] Loaded project data:', project);
            setBusinessIdea(project.business_idea as BusinessIdea);
            setTargetAudience(project.target_audience as TargetAudience);
            setAudienceAnalysis(project.audience_analysis as AudienceAnalysis);
            const hooks = Array.isArray(project.selected_hooks) ? project.selected_hooks : [];
            setSelectedHooks(hooks as AdHook[]);
            
            // Set appropriate step based on available data
            if (hooks.length > 0) {
              setCurrentStep(4);
            } else if (project.audience_analysis) {
              setCurrentStep(3);
            } else if (project.target_audience) {
              setCurrentStep(2);
            } else {
              setCurrentStep(1);
            }
            return;
          }
        }

        // If user is authenticated, try to load from wizard_progress
        if (user) {
          console.log('[useAdWizardState] Loading progress for authenticated user:', user.id);
          const { data: wizardData, error: wizardError } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (wizardError && wizardError.code !== 'PGRST116') {
            console.error('[useAdWizardState] Error loading wizard progress:', wizardError);
            toast({
              title: "Couldn't load your progress",
              description: "We had trouble loading your previous work. Starting fresh.",
              variant: "destructive",
            });
            return;
          }

          if (wizardData) {
            const progress = wizardData as WizardProgress;
            console.log('[useAdWizardState] Loaded wizard progress:', progress);
            setBusinessIdea(progress.business_idea);
            setTargetAudience(progress.target_audience);
            setAudienceAnalysis(progress.audience_analysis);
            setSelectedHooks(progress.selected_hooks || []);
            
            // Set appropriate step based on wizard progress
            if (progress.selected_hooks?.length > 0) {
              setCurrentStep(4);
            } else if (progress.audience_analysis) {
              setCurrentStep(3);
            } else if (progress.target_audience) {
              setCurrentStep(2);
            } else {
              setCurrentStep(1);
            }
          } else {
            // Create initial progress record for new users
            console.log('[useAdWizardState] Creating initial progress for new user');
            const { error: createError } = await supabase
              .from('wizard_progress')
              .insert({
                user_id: user.id,
                current_step: 1
              });

            if (createError) {
              console.error('[useAdWizardState] Error creating initial progress:', createError);
            }
          }
        } else {
          // For anonymous users, check session
          const sessionId = localStorage.getItem('anonymous_session_id');
          if (sessionId) {
            console.log('[useAdWizardState] Loading anonymous progress:', sessionId);
            const { data: anonData, error: anonError } = await supabase
              .from('anonymous_usage')
              .select('wizard_data')
              .eq('session_id', sessionId)
              .maybeSingle();

            if (anonError) {
              console.error('[useAdWizardState] Error loading anonymous data:', anonError);
              return;
            }

            if (anonData?.wizard_data) {
              const wizardData = anonData.wizard_data as AnonymousWizardData;
              setBusinessIdea(wizardData.business_idea || null);
              setTargetAudience(wizardData.target_audience || null);
              setAudienceAnalysis(wizardData.audience_analysis || null);
              setSelectedHooks(wizardData.selected_hooks || []);
              
              // Set appropriate step based on available data
              if (wizardData.selected_hooks?.length > 0) {
                setCurrentStep(4);
              } else if (wizardData.audience_analysis) {
                setCurrentStep(3);
              } else if (wizardData.target_audience) {
                setCurrentStep(2);
              } else {
                setCurrentStep(1);
              }
            }
          }
        }
      } catch (error) {
        console.error('[useAdWizardState] Unexpected error in loadSavedProgress:', error);
        toast({
          title: "Something went wrong",
          description: "We couldn't load your previous work. Please try refreshing the page.",
          variant: "destructive",
        });
      }
    };

    loadSavedProgress();
  }, [projectId, toast]);

  const handleIdeaSubmit = useCallback(async (idea: BusinessIdea) => {
    setBusinessIdea(idea);
    await saveWizardProgress({ business_idea: idea }, projectId);
    setCurrentStep(2);
  }, [projectId]);

  const handleAudienceSelect = useCallback(async (audience: TargetAudience) => {
    setTargetAudience(audience);
    await saveWizardProgress({ target_audience: audience }, projectId);
    setCurrentStep(3);
  }, [projectId]);

  const handleAnalysisComplete = useCallback(async (analysis: AudienceAnalysis) => {
    try {
      setAudienceAnalysis(analysis);
      
      const { data: { user } } = await supabase.auth.getUser();
      const sessionId = localStorage.getItem('anonymous_session_id');
      
      // Save progress based on authentication status
      if (user) {
        await saveWizardProgress({ audience_analysis: analysis }, projectId);
      } else if (sessionId) {
        // For anonymous users, update the wizard_data and last_completed_step
        const { error: anonymousError } = await supabase
          .from('anonymous_usage')
          .update({
            wizard_data: {
              business_idea: businessIdea,
              target_audience: targetAudience,
              audience_analysis: analysis
            },
            last_completed_step: 3
          })
          .eq('session_id', sessionId);

        if (anonymousError) {
          console.error('Error saving anonymous progress:', anonymousError);
        }
      }

      // Generate hooks for both authenticated and anonymous users
      const { data, error } = await supabase.functions.invoke('generate-ad-content', {
        body: { 
          type: 'hooks',
          businessIdea,
          targetAudience: {
            ...targetAudience,
            audienceAnalysis: analysis
          },
          isAnonymous: !user,
          sessionId
        }
      });

      if (error) {
        toast({
          title: "Error generating hooks",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data?.hooks && Array.isArray(data.hooks)) {
        setSelectedHooks(data.hooks);
        
        // Save hooks based on authentication status
        if (user) {
          await saveWizardProgress({ selected_hooks: data.hooks }, projectId);
        } else if (sessionId) {
          const { error: updateError } = await supabase
            .from('anonymous_usage')
            .update({
              wizard_data: {
                business_idea: businessIdea,
                target_audience: targetAudience,
                audience_analysis: analysis,
                selected_hooks: data.hooks
              }
            })
            .eq('session_id', sessionId);

          if (updateError) {
            console.error('Error saving anonymous hooks:', updateError);
          }
        }
        
        setCurrentStep(4);
      } else {
        throw new Error('Invalid hooks data received');
      }
    } catch (error) {
      console.error('Error in handleAnalysisComplete:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate hooks",
        variant: "destructive",
      });
    }
  }, [businessIdea, targetAudience, toast, projectId]);

  const handleBack = useCallback(() => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  }, []);

  const handleStartOver = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const success = await clearWizardProgress(projectId, user.id);
      
      if (success) {
        setBusinessIdea(null);
        setTargetAudience(null);
        setAudienceAnalysis(null);
        setSelectedHooks([]);
        setCurrentStep(1);

        toast({
          title: "Progress Reset",
          description: "Your progress has been cleared successfully.",
        });
      }
    } catch (error) {
      console.error('Error in handleStartOver:', error);
      toast({
        title: "Error",
        description: "Failed to clear progress",
        variant: "destructive",
      });
    }
  }, [projectId, toast]);

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

  return {
    currentStep,
    businessIdea,
    targetAudience,
    audienceAnalysis,
    selectedHooks,
    handleIdeaSubmit,
    handleAudienceSelect,
    handleAnalysisComplete,
    handleBack,
    handleStartOver,
    canNavigateToStep,
    setCurrentStep,
  };
};

export default useAdWizardState;
