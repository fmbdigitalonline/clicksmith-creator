import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { WizardStateProvider, useWizardState } from "./wizard/WizardStateProvider";
import WizardAuthentication from "./wizard/WizardAuthentication";
import WizardControls from "./wizard/WizardControls";
import WizardHeader from "./wizard/WizardHeader";
import WizardProgress from "./WizardProgress";
import CreateProjectDialog from "./projects/CreateProjectDialog";
import IdeaStep from "./steps/BusinessIdeaStep";
import AudienceStep from "./steps/AudienceStep";
import AudienceAnalysisStep from "./steps/AudienceAnalysisStep";
import AdGalleryStep from "./steps/AdGalleryStep";
import RegistrationWall from "./steps/auth/RegistrationWall";
import logger from "@/utils/logger";

type WizardProgress = Database['public']['Tables']['wizard_progress']['Row'];
type WizardData = {
  business_idea?: any;
  target_audience?: any;
  generated_ads?: any[];
  completed?: boolean;
  current_step?: number;
};

const WizardContent = () => {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [videoAdsEnabled, setVideoAdsEnabled] = useState(false);
  const [generatedAds, setGeneratedAds] = useState<any[]>([]);
  const [hasLoadedInitialAds, setHasLoadedInitialAds] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [anonymousData, setAnonymousData] = useState<WizardData | null>(null);
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { toast } = useToast();

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
  } = useWizardState();

  useEffect(() => {
    const loadProgress = async () => {
      try {
        logger.info('[AdWizard] Starting to load progress', {
          component: 'AdWizard',
          details: { projectId, hasAnonymousData: !!anonymousData }
        });

        if (anonymousData && currentUser) {
          logger.info('[AdWizard] Migrating anonymous data to user account', {
            component: 'AdWizard',
            details: { userId: currentUser.id }
          });

          const { error: wizardError } = await supabase
            .from('wizard_progress')
            .upsert({
              user_id: currentUser.id,
              business_idea: anonymousData.business_idea,
              target_audience: anonymousData.target_audience,
              generated_ads: anonymousData.generated_ads,
              current_step: anonymousData.current_step || 4
            });

          if (wizardError) {
            logger.error('[AdWizard] Error migrating anonymous data:', {
              component: 'AdWizard',
              details: { error: wizardError }
            });
          } else {
            setGeneratedAds(anonymousData.generated_ads || []);
            if (anonymousData.current_step) {
              setCurrentStep(anonymousData.current_step);
            }
            setAnonymousData(null);
          }
        }

        if (currentUser) {
          logger.info('[AdWizard] Loading user progress', {
            component: 'AdWizard',
            details: { userId: currentUser.id }
          });

          const { data: wizardData, error: wizardError } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();

          if (wizardError) {
            logger.error('[AdWizard] Error loading wizard progress:', {
              component: 'AdWizard',
              details: { error: wizardError }
            });
            toast({
              title: "Couldn't load your progress",
              description: "We had trouble loading your previous work. Starting fresh.",
              variant: "destructive",
            });
          }

          if (wizardData) {
            if (wizardData.generated_ads && Array.isArray(wizardData.generated_ads)) {
              logger.info('[AdWizard] Loading saved ads', {
                component: 'AdWizard',
                details: { adsCount: wizardData.generated_ads.length }
              });
              setGeneratedAds(wizardData.generated_ads);
            }
            if (wizardData.current_step) {
              setCurrentStep(wizardData.current_step);
            }
          }
        }

        setHasLoadedInitialAds(true);
      } catch (error) {
        logger.error('[AdWizard] Unexpected error in loadProgress:', {
          component: 'AdWizard',
          details: { error }
        });
        toast({
          title: "Something went wrong",
          description: "We couldn't load your previous work. Please try refreshing the page.",
          variant: "destructive",
        });
        setHasLoadedInitialAds(true);
      }
    };

    loadProgress();
  }, [projectId, navigate, toast, anonymousData, currentUser, setCurrentStep]);

  const handleCreateProject = () => {
    logger.info('[AdWizard] Creating new project', {
      component: 'AdWizard'
    });
    setShowCreateProject(true);
  };

  const handleProjectCreated = (projectId: string) => {
    logger.info('[AdWizard] Project created successfully', {
      component: 'AdWizard',
      details: { projectId }
    });
    setShowCreateProject(false);
    navigate(`/ad-wizard/${projectId}`);
  };

  const handleVideoAdsToggle = async (enabled: boolean) => {
    logger.info('[AdWizard] Toggling video ads', {
      component: 'AdWizard',
      details: { enabled }
    });
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
    logger.info('[AdWizard] Handling newly generated ads', {
      component: 'AdWizard',
      details: { adsCount: newAds.length }
    });
    setGeneratedAds(newAds);
    
    try {
      const sessionId = localStorage.getItem('anonymous_session_id');

      if (!currentUser && sessionId) {
        logger.info('[AdWizard] Saving ads for anonymous user', {
          component: 'AdWizard',
          details: { sessionId }
        });

        const { error: anonymousError } = await supabase
          .from('anonymous_usage')
          .update({
            wizard_data: {
              business_idea: businessIdea,
              target_audience: targetAudience,
              generated_ads: newAds.map(ad => ({
                ...ad,
                platform: ad.platform || 'facebook',
                id: ad.id || crypto.randomUUID(),
                size: ad.size || {
                  width: 1200,
                  height: 628,
                  label: `${ad.platform || 'facebook'} Feed`
                }
              }))
            },
            completed: true
          })
          .eq('session_id', sessionId);

        if (anonymousError) {
          logger.error('[AdWizard] Error saving anonymous ads:', {
            component: 'AdWizard',
            details: { error: anonymousError }
          });
          throw anonymousError;
        }
      }
    } catch (error: any) {
      logger.error('[AdWizard] Error in handleAdsGenerated:', {
        component: 'AdWizard',
        details: { error }
      });
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
  }, [
    currentStep,
    businessIdea,
    targetAudience,
    audienceAnalysis,
    selectedHooks,
    videoAdsEnabled,
    generatedAds,
    hasLoadedInitialAds,
    currentUser,
    handleBack,
    handleIdeaSubmit,
    handleAudienceSelect,
    handleAnalysisComplete,
    handleStartOver
  ]);

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <WizardAuthentication 
        onUserChange={setCurrentUser}
        onAnonymousDataChange={setAnonymousData}
      />

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

      <WizardControls
        videoAdsEnabled={videoAdsEnabled}
        onVideoAdsToggle={handleVideoAdsToggle}
      />

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

const AdWizard = () => {
  return (
    <WizardStateProvider>
      <WizardContent />
    </WizardStateProvider>
  );
};

export default AdWizard;