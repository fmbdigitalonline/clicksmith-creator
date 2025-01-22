import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useAdWizardState } from "@/hooks/useAdWizardState";
import WizardHeader from "@/components/wizard/WizardHeader";
import WizardProgress from "@/components/WizardProgress";
import { WizardControls } from "@/components/wizard/WizardControls";
import { WizardContent } from "@/components/wizard/WizardContent";
import CreateProjectDialog from "@/components/projects/CreateProjectDialog";
import { supabase } from "@/integrations/supabase/client";

type User = {
  id: string;
  email?: string;
  generated_ads?: any[];
};

const AdWizard = () => {
  const { currentStep, canNavigateToStep, handleStepClick } = useAdWizardState();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [videoAdsEnabled, setVideoAdsEnabled] = useState(false);
  const [generatedAds, setGeneratedAds] = useState<any[]>([]);
  const [hasLoadedInitialAds, setHasLoadedInitialAds] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const navigate = useNavigate();
  const { projectId } = useParams();
  const { toast } = useToast();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        toast({
          title: "Error fetching user",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      setCurrentUser(user);
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const loadInitialAds = async () => {
      if (projectId) {
        const { data, error } = await supabase
          .from('projects')
          .select('generated_ads')
          .eq('id', projectId)
          .single();

        if (error) {
          toast({
            title: "Error loading ads",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        const adsArray = Array.isArray(data?.generated_ads) ? data.generated_ads : [];
        setGeneratedAds(adsArray);
        setHasLoadedInitialAds(true);
      }
    };

    loadInitialAds();
  }, [projectId]);

  const handleVideoAdsToggle = () => {
    setVideoAdsEnabled((prev) => !prev);
  };

  const handleAdsGenerated = (ads: any[]) => {
    setGeneratedAds(ads);
  };

  const handleCreateProject = () => {
    setShowCreateProject(true);
  };

  const handleProjectCreated = () => {
    setShowCreateProject(false);
    toast({
      title: "Project Created",
      description: "Your project has been created successfully.",
    });
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

export default AdWizard;