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
import { Button } from "./ui/button";
import { Save } from "lucide-react";

interface WizardData {
  business_idea?: any;
  target_audience?: any;
  audience_analysis?: any;
  generated_ads?: any[];
  current_step?: number;
  completed?: boolean;
}

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
        console.log('[AdWizard] Starting to load progress');
        if (anonymousData && currentUser) {
          console.log('[AdWizard] Migrating anonymous data to user account:', anonymousData);
          const { error: wizardError } = await supabase
            .from('wizard_progress')
            .upsert({
              user_id: currentUser.id,
              business_idea: anonymousData.business_idea || null,
              target_audience: anonymousData.target_audience || null,
              audience_analysis: anonymousData.audience_analysis || null,
              generated_ads: anonymousData.generated_ads || [],
              current_step: anonymousData.current_step || 4,
              version: 1
            });

          if (wizardError) {
            console.error('[AdWizard] Error migrating anonymous data:', wizardError);
          } else {
            setGeneratedAds(anonymousData.generated_ads || []);
            setAnonymousData(null);
            console.log('[AdWizard] Successfully migrated anonymous data');
          }
        }

        if (currentUser) {
          const { data: wizardData, error: wizardError } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();

          if (wizardError) {
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
  }, [projectId, navigate, toast, anonymousData, currentUser]);

  const handleCreateProject = () => setShowCreateProject(true);
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
      const sessionId = localStorage.getItem('anonymous_session_id');

      if (!currentUser && sessionId) {
        console.log('[AdWizard] Saving ads for anonymous user');
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

  const handleSaveToProject = async () => {
    if (!currentUser) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save your progress to a project.",
        variant: "destructive",
      });
      return;
    }

    try {
      const projectData = {
        title: businessIdea?.description?.substring(0, 50) || "New Project",
        description: businessIdea?.description,
        user_id: currentUser.id,
        business_idea: businessIdea,
        target_audience: targetAudience,
        audience_analysis: audienceAnalysis,
        status: "in_progress",
      };

      const { data, error } = await supabase
        .from("projects")
        .insert(projectData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Project Saved",
        description: "Your progress has been saved to a new project.",
      });

      if (data) {
        navigate(`/ad-wizard/${data.id}`);
      }
    } catch (error) {
      console.error('[AdWizard] Error saving project:', error);
      toast({
        title: "Error Saving Project",
        description: "There was an error saving your progress. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderSaveButton = () => {
    if (currentStep >= 1 && currentStep <= 3 && businessIdea) {
      return (
        <Button 
          onClick={handleSaveToProject}
          className="ml-4"
          variant="outline"
        >
          <Save className="w-4 h-4 mr-2" />
          Save to Project
        </Button>
      );
    }
    return null;
  };

  const currentStepComponent = useMemo(() => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <IdeaStep onNext={handleIdeaSubmit} />
            {renderSaveButton()}
          </>
        );
      case 2:
        return businessIdea ? (
          <>
            <AudienceStep
              businessIdea={businessIdea}
              onNext={handleAudienceSelect}
              onBack={handleBack}
            />
            {renderSaveButton()}
          </>
        ) : null;
      case 3:
        return businessIdea && targetAudience ? (
          <>
            <AudienceAnalysisStep
              businessIdea={businessIdea}
              targetAudience={targetAudience}
              onNext={handleAnalysisComplete}
              onBack={handleBack}
            />
            {renderSaveButton()}
          </>
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