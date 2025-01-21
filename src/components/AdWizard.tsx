import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import WizardHeader from "./wizard/WizardHeader";
import WizardProgress from "./WizardProgress";
import CreateProjectDialog from "./projects/CreateProjectDialog";
import { WizardStateProvider, useWizardState } from "./wizard/WizardStateProvider";
import { WizardControls } from "./wizard/WizardControls";
import { WizardContent } from "./wizard/WizardContent";
import type { Database } from "@/integrations/supabase/types";

type WizardData = {
  business_idea?: any;
  target_audience?: any;
  generated_ads?: any[];
};

const WizardContainer = () => {
  const { currentStep, canNavigateToStep, handleStepClick } = useWizardState();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [videoAdsEnabled, setVideoAdsEnabled] = useState(false);
  const [generatedAds, setGeneratedAds] = useState<any[]>([]);
  const [hasLoadedInitialAds, setHasLoadedInitialAds] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [anonymousData, setAnonymousData] = useState<any>(null);
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          const { data: anonData } = await supabase
            .from('anonymous_usage')
            .select('wizard_data')
            .eq('session_id', sessionId)
            .maybeSingle();

          if (anonData?.wizard_data) {
            setAnonymousData(anonData.wizard_data);
            localStorage.removeItem('anonymous_session_id');
          }
        }
      }
    };
    checkUser();
  }, []);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        console.log('[AdWizard] Starting to load progress');
        const { data: { user } } = await supabase.auth.getUser();
        let sessionId = localStorage.getItem('anonymous_session_id');
        
        if (!user) {
          if (!sessionId) {
            sessionId = uuidv4();
            localStorage.setItem('anonymous_session_id', sessionId);
            console.log('[AdWizard] Created new anonymous session:', sessionId);
          }
          
          console.log('[AdWizard] Anonymous user detected, checking session:', sessionId);
          
          try {
            const { data: anonymousData, error: anonymousError } = await supabase
              .from('anonymous_usage')
              .select('wizard_data, used, completed')
              .eq('session_id', sessionId)
              .maybeSingle();

            if (anonymousError) {
              console.error('[AdWizard] Error fetching anonymous data:', anonymousError);
              throw anonymousError;
            }

            console.log('[AdWizard] Anonymous data retrieved:', anonymousData);

            if (anonymousData?.completed) {
              console.log('[AdWizard] Anonymous session already completed');
              toast({
                title: "Trial completed",
                description: "Your trial has been completed. Please register to continue generating ads.",
                duration: 6000,
                variant: "destructive",
              });
              return;
            }

            if (anonymousData?.wizard_data) {
              const wizardData = anonymousData.wizard_data as WizardData;
              if (wizardData.generated_ads && Array.isArray(wizardData.generated_ads)) {
                console.log('[AdWizard] Loading anonymous user ads:', wizardData.generated_ads);
                setGeneratedAds(wizardData.generated_ads);
              }
            }
          } catch (error) {
            console.error('[AdWizard] Error processing anonymous data:', error);
            toast({
              title: "Error loading data",
              description: "We encountered an error loading your previous work. Starting fresh.",
              variant: "destructive",
            });
          }
          
          toast({
            title: "Trial mode active",
            description: "You can try generating one set of ads before registering.",
            duration: 6000,
          });
          setHasLoadedInitialAds(true);
          return;
        }

        if (anonymousData) {
          console.log('[AdWizard] Migrating anonymous data to user account');
          const { error: wizardError } = await supabase
            .from('wizard_progress')
            .upsert({
              user_id: user.id,
              business_idea: anonymousData.business_idea,
              target_audience: anonymousData.target_audience,
              generated_ads: anonymousData.generated_ads,
              current_step: 4
            });

          if (wizardError) {
            console.error('[AdWizard] Error migrating anonymous data:', wizardError);
          } else {
            setGeneratedAds(anonymousData.generated_ads || []);
            setAnonymousData(null);
          }
        }

        console.log('[AdWizard] Authenticated user, loading project data');

        if (projectId && projectId !== 'new') {
          const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('generated_ads, video_ads_enabled')
            .eq('id', projectId)
            .maybeSingle();

          if (projectError) {
            console.error('[AdWizard] Error loading project:', projectError);
            toast({
              title: "Couldn't load your project",
              description: "We had trouble loading your project data. Please try again.",
              variant: "destructive",
            });
            return;
          }

          if (!project) {
            console.log('[AdWizard] Project not found, redirecting to new');
            navigate('/ad-wizard/new');
          } else {
            console.log('[AdWizard] Project loaded successfully:', project);
            setVideoAdsEnabled(project.video_ads_enabled || false);
            if (project.generated_ads && Array.isArray(project.generated_ads)) {
              console.log('[AdWizard] Loading saved ads from project:', project.generated_ads);
              setGeneratedAds(project.generated_ads);
            }
          }
        } else {
          console.log('[AdWizard] Loading wizard progress for user');
          const { data: wizardData, error: wizardError } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (wizardError && wizardError.code !== 'PGRST116') {
            console.error('[AdWizard] Error loading wizard progress:', wizardError);
            toast({
              title: "Couldn't load your progress",
              description: "We had trouble loading your previous work. Starting fresh.",
              variant: "destructive",
            });
          }

          if (wizardData?.generated_ads && Array.isArray(wizardData.generated_ads)) {
            console.log('[AdWizard] Loading saved ads from wizard progress:', wizardData.generated_ads);
            setGeneratedAds(wizardData.generated_ads);
          }
        }
        setHasLoadedInitialAds(true);
      } catch (error) {
        console.error('[AdWizard] Unexpected error in loadProgress:', error);
        toast({
          title: "Something went wrong",
          description: "We couldn't load your previous work. Please try refreshing the page.",
          variant: "destructive",
        });
        setHasLoadedInitialAds(true);
      }
    };

    loadProgress();
  }, [projectId, navigate, toast, anonymousData]);

  const handleCreateProject = () => {
    setShowCreateProject(true);
  };

  const handleProjectCreated = (projectId: string) => {
    setShowCreateProject(false);
    navigate(`/ad-wizard/${projectId}`);
  };

  const handleVideoAdsToggle = async (enabled: boolean) => {
    setVideoAdsEnabled(enabled);
    if (projectId && projectId !== 'new') {
      await supabase
        .from('projects')
        .update({ 
          video_ads_enabled: enabled,
          video_ad_preferences: enabled ? {
            format: 'landscape',
            duration: 30
          } : null
        })
        .eq('id', projectId);
    }
  };

  const handleAdsGenerated = async (newAds: any[]) => {
    console.log('[AdWizard] Handling newly generated ads:', newAds);
    setGeneratedAds(newAds);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const sessionId = localStorage.getItem('anonymous_session_id');

      if (user) {
        console.log('[AdWizard] Saving ads for authenticated user');
        if (projectId && projectId !== 'new') {
          const { error: updateError } = await supabase
            .from('projects')
            .update({ generated_ads: newAds })
            .eq('id', projectId);

          if (updateError) {
            console.error('[AdWizard] Error updating project ads:', updateError);
            throw updateError;
          }
        } else {
          const { error: upsertError } = await supabase
            .from('wizard_progress')
            .upsert({
              user_id: user.id,
              generated_ads: newAds
            }, {
              onConflict: 'user_id'
            });

          if (upsertError) {
            console.error('[AdWizard] Error upserting wizard progress:', upsertError);
            throw upsertError;
          }
        }
      } else if (sessionId) {
        console.log('[AdWizard] Saving ads for anonymous user');
        const { error: anonymousError } = await supabase
          .from('anonymous_usage')
          .upsert({
            session_id: sessionId,
            used: true,
            wizard_data: {
              business_idea: anonymousData?.business_idea,
              target_audience: anonymousData?.target_audience,
              generated_ads: newAds
            } as WizardData,
            completed: true
          }, {
            onConflict: 'session_id'
          });

        if (anonymousError) {
          console.error('[AdWizard] Error saving anonymous ads:', anonymousError);
          throw anonymousError;
        }
      }
    } catch (error: any) {
      console.error('[AdWizard] Error in handleAdsGenerated:', error);
      toast({
        title: "Couldn't save your ads",
        description: "Your ads were generated but we couldn't save them. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <WizardHeader
        title="Idea Pilot"
        description="Quickly go from idea to ready-to-run ads by testing different audience segments with AI-powered social media ad campaigns."
      />

      <div className="mb-8">
        <WizardProgress 
          currentStep={currentStep}
          onStepClick={handleStepClick}
          canNavigateToStep={canNavigateToStep}
        />
      </div>

      <WizardControls
        videoAdsEnabled={videoAdsEnabled}
        onVideoAdsToggle={handleVideoAdsToggle}
      />

      <WizardContent
        currentUser={currentUser}
        videoAdsEnabled={videoAdsEnabled}
        generatedAds={generatedAds}
        onAdsGenerated={handleAdsGenerated}
        hasLoadedInitialAds={hasLoadedInitialAds}
        onCreateProject={handleCreateProject}
      />

      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onSuccess={handleProjectCreated}
        initialBusinessIdea={null}
      />
    </div>
  );
};

const AdWizard = () => {
  return (
    <WizardStateProvider>
      <WizardContainer />
    </WizardStateProvider>
  );
};

export default AdWizard;
