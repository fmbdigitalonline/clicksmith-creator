import { useState, useEffect } from "react";
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
    setBusinessIdea,
    setTargetAudience,
    setAudienceAnalysis,
    setCurrentStep,
    canNavigateToStep
  } = useWizardState();

  useEffect(() => {
    const loadProgress = async () => {
      try {
        console.log('[WizardContent] Starting to load progress');
        
        // If we have both anonymous data and a current user, handle migration
        if (anonymousData && currentUser) {
          console.log('[WizardContent] Checking existing progress for user:', currentUser.id);
          
          const { data: existingProgress } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();

          if (existingProgress) {
            console.log('[WizardContent] Found existing progress');
            
            // Always use the highest step between existing and anonymous data
            const targetStep = Math.max(
              existingProgress.current_step || 1,
              anonymousData.current_step || 1
            );

            // Set all the wizard state
            if (anonymousData.business_idea) setBusinessIdea(anonymousData.business_idea);
            if (anonymousData.target_audience) setTargetAudience(anonymousData.target_audience);
            if (anonymousData.audience_analysis) setAudienceAnalysis(anonymousData.audience_analysis);
            if (anonymousData.generated_ads) setGeneratedAds(anonymousData.generated_ads);
            
            // Update the current step and navigate if needed
            setCurrentStep(targetStep);
            
            // Only navigate if we're not already on the correct step
            const currentPathMatch = window.location.pathname.match(/step-(\d+)/);
            const currentUrlStep = currentPathMatch ? parseInt(currentPathMatch[1]) : null;
            
            if (targetStep > 1 && (!currentUrlStep || currentUrlStep !== targetStep)) {
              console.log('[WizardContent] Navigating to step:', targetStep);
              navigate(`/ad-wizard/step-${targetStep}`, { replace: true });
            }
          }

          // Clear anonymous data after migration
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
      }
    };

    loadProgress();
  }, [projectId, navigate, toast, anonymousData, currentUser, setBusinessIdea, setTargetAudience, setAudienceAnalysis, setCurrentStep]);

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
        onVideoAdsToggle={handleVideoAdsToggle}
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