import { useAdWizardState } from "@/hooks/useAdWizardState";
import IdeaStep from "./steps/BusinessIdeaStep";
import AudienceStep from "./steps/AudienceStep";
import AudienceAnalysisStep from "./steps/AudienceAnalysisStep";
import AdGalleryStep from "./steps/AdGalleryStep";
import RegistrationWall from "./steps/auth/RegistrationWall";
import WizardHeader from "./wizard/WizardHeader";
import WizardProgress from "./WizardProgress";
import { useState, useMemo, useEffect } from "react";
import CreateProjectDialog from "./projects/CreateProjectDialog";
import { useNavigate, useParams } from "react-router-dom";
import { Toggle } from "./ui/toggle";
import { Video, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';

type WizardProgress = Database['public']['Tables']['wizard_progress']['Row'];
type WizardData = {
  business_idea?: any;
  target_audience?: any;
  generated_ads?: any[];
};

const AdWizard = () => {
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

      // If user just registered, try to migrate anonymous data
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
            // Clear the anonymous session ID after migration
            localStorage.removeItem('anonymous_session_id');
          }
        }
      }
    };
    checkUser();
  }, []);

  const {
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
  } = useAdWizardState();

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

        // If we have anonymous data to migrate
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
              business_idea: businessIdea,
              target_audience: targetAudience,
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

  const currentStepComponent = useMemo(() => {
    switch (currentStep) {
      case 1:
        return <IdeaStep onNext={handleIdeaSubmit} />;
      case 2:
        return businessIdea ? (
          <AudienceStep
            businessIdea={businessIdea}
            onNext={handleAudienceSelect}
            onBack={handleBack}
          />
        ) : null;
      case 3:
        return businessIdea && targetAudience ? (
          <AudienceAnalysisStep
            businessIdea={businessIdea}
            targetAudience={targetAudience}
            onNext={handleAnalysisComplete}
            onBack={handleBack}
          />
        ) : null;
      case 4:
        if (!currentUser) {
          return <RegistrationWall onBack={handleBack} />;
        }
        return businessIdea && targetAudience && audienceAnalysis ? (
          <AdGalleryStep
            businessIdea={businessIdea}
            targetAudience={targetAudience}
            adHooks={selectedHooks}
            onStartOver={handleStartOver}
            onBack={handleBack}
            onCreateProject={handleCreateProject}
            videoAdsEnabled={videoAdsEnabled}
            generatedAds={generatedAds}
            onAdsGenerated={handleAdsGenerated}
            hasLoadedInitialAds={hasLoadedInitialAds}
          />
        ) : null;
      default:
        return null;
    }
  }, [currentStep, businessIdea, targetAudience, audienceAnalysis, selectedHooks, videoAdsEnabled, generatedAds, hasLoadedInitialAds, currentUser]);

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <WizardHeader
        title="Idea Pilot"
        description="Quickly go from idea to ready-to-run ads by testing different audience segments with AI-powered social media ad campaigns."
      />

      <div className="mb-8">
        <WizardProgress
          currentStep={currentStep}
          onStepClick={setCurrentStep}
          canNavigateToStep={canNavigateToStep}
        />
      </div>

      <div className="flex items-center justify-end mb-6 space-x-2">
        <span className="text-sm text-gray-600">Image Ads</span>
        <Toggle
          pressed={videoAdsEnabled}
          onPressedChange={handleVideoAdsToggle}
          aria-label="Toggle video ads"
          className="data-[state=on]:bg-facebook"
        >
          {videoAdsEnabled ? (
            <Video className="h-4 w-4" />
          ) : (
            <Image className="h-4 w-4" />
          )}
        </Toggle>
        <span className="text-sm text-gray-600">Video Ads</span>
      </div>

      {currentStepComponent}

      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onSuccess={handleProjectCreated}
        initialBusinessIdea={businessIdea?.description}
      />
    </div>
  );
};

export default AdWizard;
