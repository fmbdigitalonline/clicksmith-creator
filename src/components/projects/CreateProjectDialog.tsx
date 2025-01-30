import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import ProjectForm, { ProjectFormData } from "./ProjectForm";
import ProjectActions from "./ProjectActions";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (projectId: string) => void;
  onStartAdWizard?: (projectId?: string) => void;
  initialBusinessIdea?: string;
}

const CreateProjectDialog = ({
  open,
  onOpenChange,
  onSuccess,
  onStartAdWizard,
  initialBusinessIdea,
}: CreateProjectDialogProps) => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [includeWizardProgress, setIncludeWizardProgress] = useState(true);
  
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const handleSubmit = async (values: ProjectFormData) => {
    if (!userId) {
      toast({
        title: "Error creating project",
        description: "You must be logged in to create a project",
        variant: "destructive",
      });
      return;
    }

    const tags = values.tags
      ? values.tags.split(",").map((tag) => tag.trim())
      : [];

    let projectData: any = {
      title: values.title,
      description: values.description || null,
      tags,
      user_id: userId,
      status: "draft",
      business_idea: {
        description: values.businessIdea,
        valueProposition: `Enhanced version of: ${values.businessIdea}`,
      },
    };

    if (includeWizardProgress) {
      // Fetch current wizard progress
      const { data: wizardProgress } = await supabase
        .from('wizard_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (wizardProgress) {
        // Include wizard progress data in project
        projectData = {
          ...projectData,
          target_audience: wizardProgress.target_audience,
          audience_analysis: wizardProgress.audience_analysis,
          selected_hooks: wizardProgress.selected_hooks,
          ad_format: wizardProgress.ad_format,
          video_ad_preferences: wizardProgress.video_ad_preferences,
          generated_ads: wizardProgress.generated_ads,
        };

        // After creating the project, update any existing ad_feedback entries
        const { data: adFeedback } = await supabase
          .from('ad_feedback')
          .select('id')
          .is('project_id', null)
          .eq('user_id', userId);

        if (adFeedback && adFeedback.length > 0) {
          const feedbackIds = adFeedback.map(feedback => feedback.id);
          
          // Update ad_feedback entries with the new project_id
          await supabase
            .from('ad_feedback')
            .update({ project_id: projectData.id })
            .in('id', feedbackIds);
        }
      }
    }

    const { data, error } = await supabase
      .from("projects")
      .insert(projectData)
      .select();

    if (error) {
      toast({
        title: "Error creating project",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (data && data[0]) {
      setCreatedProjectId(data[0].id);
      setShowActions(true);
      toast({
        title: "Project created",
        description: "Your project has been created successfully.",
      });
      onSuccess(data[0].id);
    }
  };

  const handleGenerateAds = () => {
    if (createdProjectId && onStartAdWizard) {
      onStartAdWizard(createdProjectId);
      onOpenChange(false);
    }
  };

  const handleBackToProjects = () => {
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) {
      setShowActions(false);
      setCreatedProjectId(null);
      setIncludeWizardProgress(true);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {showActions ? "What's next?" : "Create New Validation Project"}
          </DialogTitle>
          <DialogDescription>
            {showActions 
              ? "Choose your next action for the project"
              : "Start validating your business idea through market testing"
            }
          </DialogDescription>
        </DialogHeader>
        {!showActions ? (
          <>
            <ProjectForm
              onSubmit={handleSubmit}
              onCancel={() => onOpenChange(false)}
              initialBusinessIdea={initialBusinessIdea}
            />
            <div className="flex items-center space-x-2 mt-4">
              <Checkbox
                id="includeProgress"
                checked={includeWizardProgress}
                onCheckedChange={(checked) => setIncludeWizardProgress(checked as boolean)}
              />
              <Label htmlFor="includeProgress">
                Include wizard progress data in the project
              </Label>
            </div>
          </>
        ) : (
          <ProjectActions
            onGenerateAds={handleGenerateAds}
            onBackToProjects={handleBackToProjects}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialog;