import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { useWizardStore, useWizardUrlSync } from "@/stores/wizardStore";
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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [anonymousData, setAnonymousData] = useState<WizardData | null>(null);
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { toast } = useToast();

  // Use our enhanced wizard store
  const {
    currentStep,
    businessIdea,
    setBusinessIdea,
    setTargetAudience,
    setAudienceAnalysis,
    setCurrentStep,
    canNavigateToStep
  } = useWizardStore();

  // Use URL sync hook
  useWizardUrlSync();

  // Handle anonymous data migration
  useEffect(() => {
    const migrateAnonymousData = async () => {
      if (anonymousData && currentUser) {
        try {
          const { data: migrationResult, error } = await supabase.rpc(
            'atomic_migration',
            {
              p_user_id: currentUser.id,
              p_session_id: localStorage.getItem('anonymous_session_id'),
              p_calculated_step: currentStep
            }
          );

          if (error) throw error;

          if (migrationResult) {
            // Update store with migrated data
            if (migrationResult.business_idea) setBusinessIdea(migrationResult.business_idea);
            if (migrationResult.target_audience) setTargetAudience(migrationResult.target_audience);
            if (migrationResult.audience_analysis) setAudienceAnalysis(migrationResult.audience_analysis);
            
            setAnonymousData(null);
          }
        } catch (error) {
          console.error('[WizardContent] Migration error:', error);
          toast({
            title: "Error migrating data",
            description: "There was an error migrating your progress. Please try again.",
            variant: "destructive",
          });
        }
      }
    };

    migrateAnonymousData();
  }, [currentUser, anonymousData]);

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
