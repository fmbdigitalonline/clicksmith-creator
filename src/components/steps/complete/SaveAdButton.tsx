import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdHook, AdImage } from "@/types/adWizard";
import { saveAd } from "@/utils/adSaving";

interface SaveAdButtonProps {
  image: AdImage;
  hook: AdHook;
  primaryText?: string;
  headline?: string;
  rating: string;
  feedback: string;
  projectId?: string;
  onCreateProject?: () => void;
  onSaveSuccess: () => void;
}

export const SaveAdButton = ({
  image,
  hook,
  primaryText,
  headline,
  rating,
  feedback,
  projectId,
  onCreateProject,
  onSaveSuccess,
}: SaveAdButtonProps) => {
  const [isSaving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (isSaving) {
      console.log('[SaveAdButton] Submission already in progress, preventing duplicate');
      return;
    }

    setSaving(true);
    try {
      const result = await saveAd({
        image,
        hook,
        rating,
        feedback,
        projectId,
        primaryText,
        headline
      });

      if (result.success) {
        onSaveSuccess();
        toast({
          title: "Success!",
          description: result.message,
        });
      } else {
        if (result.shouldCreateProject && onCreateProject) {
          toast({
            title: result.message,
            description: "Please create a project to save your ad.",
            action: (
              <Button variant="outline" onClick={onCreateProject}>
                Create Project
              </Button>
            ),
          });
        } else {
          toast({
            title: "Error",
            description: result.message,
            variant: "destructive",
          });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      onClick={handleSave}
      className="w-full bg-facebook hover:bg-facebook/90"
      disabled={isSaving}
    >
      {isSaving ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Saving...
        </>
      ) : (
        <>
          <Save className="w-4 h-4 mr-2" />
          Save Ad
        </>
      )}
    </Button>
  );
};