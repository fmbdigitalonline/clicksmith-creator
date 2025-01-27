import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { useWizardState } from "./WizardStateProvider";
import WizardAuthentication from "./WizardAuthentication";
import WizardControls from "./WizardControls";
import WizardHeader from "./WizardHeader";
import WizardProgress from "../WizardProgress";
import WizardSteps from "./WizardSteps";
import CreateProjectDialog from "../projects/CreateProjectDialog";
import { Button } from "../ui/button";
import { Save } from "lucide-react";
import { debounce } from "lodash";

const WizardContent = () => {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [videoAdsEnabled, setVideoAdsEnabled] = useState(false);
  const [generatedAds, setGeneratedAds] = useState<any[]>([]);
  const [hasLoadedInitialAds, setHasLoadedInitialAds] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [anonymousData, setAnonymousData] = useState<WizardData | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { toast } = useToast();

  const {
    currentStep,
    businessIdea,
    setBusinessIdea,
    setTargetAudience,
    setAudienceAnalysis,
    setCurrentStep,
    canNavigateToStep
  } = useWizardState();

  // Debounced progress loading function
  const debouncedLoadProgress = useCallback(
    debounce(async () => {
      if (isLoadingProgress) return;
      setIsLoadingProgress(true);
      
      try {
        console.log('[WizardContent] Starting to load progress');
        
        if (anonymousData && currentUser) {
          console.log('[WizardContent] Checking existing progress for user:', currentUser.id);
          
          const { data: existingProgress } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();

          if (existingProgress) {
            console.log('[WizardContent] Found existing progress with step:', existingProgress.current_step);
            
            const targetStep = Math.max(
              existingProgress.current_step || 1,
              anonymousData.current_step || 1
            );
            
            if (anonymousData.business_idea || existingProgress.business_idea) {
              setBusinessIdea(anonymousData.business_idea || existingProgress.business_idea);
            }
            if (anonymousData.target_audience || existingProgress.target_audience) {
              setTargetAudience(anonymousData.target_audience || existingProgress.target_audience);
            }
            if (anonymousData.audience_analysis || existingProgress.audience_analysis) {
              setAudienceAnalysis(anonymousData.audience_analysis || existingProgress.audience_analysis);
            }
            if (anonymousData.generated_ads || existingProgress.generated_ads) {
              const anonymousAds = Array.isArray(anonymousData.generated_ads) ? anonymousData.generated_ads : [];
              const existingAds = Array.isArray(existingProgress.generated_ads) ? existingProgress.generated_ads : [];
              setGeneratedAds([...anonymousAds, ...existingAds]);
            }
            
            if (targetStep > 1 && canNavigateToStep(targetStep)) {
              setCurrentStep(targetStep);
              if (window.location.pathname === '/ad-wizard/new') {
                navigate(`/ad-wizard/step-${targetStep}`, { replace: true });
              }
            }
          }

          setAnonymousData(null);
          console.log('[WizardContent] Successfully migrated anonymous data');
        }

        setHasLoadedInitialAds(true);
      } catch (error) {
        console.error('[WizardContent] Error in loadProgress:', error);
        toast({
          title: "Something went wrong",
          description: "We couldn't load your previous work. Please try refreshing the page.",
          variant: "destructive",
        });
        setHasLoadedInitialAds(true);
      } finally {
        setIsLoadingProgress(false);
      }
    }, 1000),
    [projectId, navigate, toast, anonymousData, currentUser, setBusinessIdea, setTargetAudience, setAudienceAnalysis, setCurrentStep, canNavigateToStep]
  );

  useEffect(() => {
    debouncedLoadProgress();
    return () => {
      debouncedLoadProgress.cancel();
    };
  }, [debouncedLoadProgress]);

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
      console.error('[WizardContent] Error saving project:', error);
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
        onVideoAdsToggle={setVideoAdsEnabled}
      />

      <WizardSteps 
        currentUser={currentUser}
        videoAdsEnabled={videoAdsEnabled}
        generatedAds={generatedAds}
        hasLoadedInitialAds={hasLoadedInitialAds}
        onCreateProject={handleCreateProject}
        renderSaveButton={renderSaveButton}
      />

      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onSuccess={handleProjectCreated}
        initialBusinessIdea={businessIdea?.description}
      />
    </div>
  );
};

export default WizardContent;
