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
import { Database } from "@/integrations/supabase/types";

type WizardProgress = Database['public']['Tables']['wizard_progress']['Row'];

const AdWizard = () => {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [videoAdsEnabled, setVideoAdsEnabled] = useState(false);
  const [generatedAds, setGeneratedAds] = useState<any[]>([]);
  const [hasLoadedInitialAds, setHasLoadedInitialAds] = useState(false);
  const navigate = useNavigate();
  const { projectId } = useParams();
  
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

  // Load saved progress including generated ads
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (projectId && projectId !== 'new') {
          const { data: project } = await supabase
            .from('projects')
            .select('generated_ads, video_ads_enabled')
            .eq('id', projectId)
            .single();

          if (!project) {
            navigate('/ad-wizard/new');
          } else {
            setVideoAdsEnabled(project.video_ads_enabled || false);
            if (project.generated_ads && Array.isArray(project.generated_ads)) {
              console.log('Loading saved ads from project:', project.generated_ads);
              setGeneratedAds(project.generated_ads);
            }
          }
        } else {
          const { data: wizardData } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (wizardData?.generated_ads && Array.isArray(wizardData.generated_ads)) {
            console.log('Loading saved ads from wizard progress:', wizardData.generated_ads);
            setGeneratedAds(wizardData.generated_ads);
          }
        }
        setHasLoadedInitialAds(true);
      } catch (error) {
        console.error('Error loading progress:', error);
        setHasLoadedInitialAds(true);
      }
    };

    loadProgress();
  }, [projectId, navigate]);

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
    console.log('Handling newly generated ads:', newAds);
    setGeneratedAds(newAds);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (projectId && projectId !== 'new') {
      await supabase
        .from('projects')
        .update({ generated_ads: newAds })
        .eq('id', projectId);
    } else {
      await supabase
        .from('wizard_progress')
        .upsert({
          user_id: user.id,
          generated_ads: newAds
        }, {
          onConflict: 'user_id'
        });
    }
  };

  // Memoize the current step component to prevent unnecessary re-renders
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
  }, [currentStep, businessIdea, targetAudience, audienceAnalysis, selectedHooks, videoAdsEnabled, generatedAds, hasLoadedInitialAds]);

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