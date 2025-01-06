import { useAdWizardState } from "@/hooks/useAdWizardState";
import IdeaStep from "./steps/BusinessIdeaStep";
import AudienceStep from "./steps/AudienceStep";
import AudienceAnalysisStep from "./steps/AudienceAnalysisStep";
import AdGalleryStep from "./steps/AdGalleryStep";
import WizardHeader from "./wizard/WizardHeader";
import WizardProgress from "./WizardProgress";
import { useState, useMemo, useEffect } from "react";
import CreateProjectDialog from "./projects/CreateProjectDialog";
import { useNavigate, useParams } from "react-router-dom";
import { Toggle } from "./ui/toggle";
import { Video, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAnonymousSession } from "@/hooks/useAnonymousSession";
import { useToast } from "@/hooks/use-toast";

const AdWizard = () => {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [videoAdsEnabled, setVideoAdsEnabled] = useState(false);
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { sessionId, hasUsedTrial, markSessionAsUsed } = useAnonymousSession();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
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
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);

      // Only redirect if trial used and not authenticated
      if (!user && hasUsedTrial && projectId === 'new') {
        toast({
          title: "Free Trial Used",
          description: "Please sign up to continue using ProfitPilot and get 11 more free credits!",
          variant: "destructive",
        });
        navigate("/login");
      }
    };

    checkAuth();
  }, [hasUsedTrial, navigate, projectId]);

  // Handle project initialization
  useEffect(() => {
    const initializeProject = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        if (projectId === "new") {
          // Clear any existing wizard progress when starting new
          await supabase
            .from('wizard_progress')
            .delete()
            .eq('user_id', user.id);
        } else if (projectId) {
          // If it's an existing project, fetch its data
          const { data: project } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

          if (!project) {
            navigate('/ad-wizard/new');
          } else {
            setVideoAdsEnabled(project.video_ads_enabled || false);
          }
        }
      }
    };

    initializeProject();
  }, [projectId, navigate]);

  const handleCreateProject = () => {
    if (!isAuthenticated) {
      toast({
        title: "Registration Required",
        description: "Please sign up to save your projects and continue using ProfitPilot!",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }
    setShowCreateProject(true);
  };

  const handleProjectCreated = (projectId: string) => {
    setShowCreateProject(false);
    navigate(`/ad-wizard/${projectId}`);
  };

  const handleVideoAdsToggle = async (enabled: boolean) => {
    if (!isAuthenticated) {
      toast({
        title: "Registration Required",
        description: "Please sign up to access video ads and more features!",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

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

  // Memoize the current step component to prevent unnecessary re-renders
  const currentStepComponent = useMemo(() => {
    const props = {
      isAnonymous: !isAuthenticated,
      onMarkSessionUsed: markSessionAsUsed,
      sessionId,
    };

    switch (currentStep) {
      case 1:
        return <IdeaStep onNext={handleIdeaSubmit} {...props} />;
      case 2:
        return businessIdea ? (
          <AudienceStep
            businessIdea={businessIdea}
            onNext={handleAudienceSelect}
            onBack={handleBack}
            {...props}
          />
        ) : null;
      case 3:
        return businessIdea && targetAudience ? (
          <AudienceAnalysisStep
            businessIdea={businessIdea}
            targetAudience={targetAudience}
            onNext={handleAnalysisComplete}
            onBack={handleBack}
            {...props}
          />
        ) : null;
      case 4:
        return businessIdea && targetAudience && audienceAnalysis ? (
          <AdGalleryStep
            businessIdea={businessIdea}
            targetAudience={targetAudience}
            adHooks={selectedHooks}
            onStartOver={handleStartOver}
            onBack={handleBack}
            onCreateProject={handleCreateProject}
            videoAdsEnabled={videoAdsEnabled}
            isAnonymous={!isAuthenticated}
            {...props}
          />
        ) : null;
      default:
        return null;
    }
  }, [currentStep, businessIdea, targetAudience, audienceAnalysis, selectedHooks, videoAdsEnabled, isAuthenticated, sessionId]);

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <WizardHeader
        title="ProfitPilot"
        description="Quickly go from idea to ready-to-run ads by testing different audience segments with AI-powered Facebook ad campaigns."
      />

      <div className="mb-8">
        <WizardProgress
          currentStep={currentStep}
          onStepClick={setCurrentStep}
          canNavigateToStep={canNavigateToStep}
        />
      </div>

      {isAuthenticated && (
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
      )}

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