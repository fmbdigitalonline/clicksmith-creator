import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdHook, AdImage } from "@/types/adWizard";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from 'uuid';

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

    if (!rating) {
      toast({
        title: "Rating Required",
        description: "Please provide a rating before saving.",
        variant: "destructive",
      });
      return;
    }

    if (!image?.url) {
      toast({
        title: "Invalid Image",
        description: "No valid image URL found to save.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    console.log('[SaveAdButton] Starting save operation...');

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      
      console.log('[SaveAdButton] Auth check:', { 
        hasUser: !!authData?.user,
        authError 
      });

      if (authError || !authData?.user) {
        throw new Error('Authentication required to save ads');
      }

      const user = authData.user;

      if (projectId === "new") {
        if (onCreateProject) {
          onCreateProject();
        } else {
          toast({
            title: "Create Project First",
            description: "Please create a project to save your ad.",
          });
        }
        return;
      }

      const isValidUUID = projectId && 
                         /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId);

      // First check if feedback already exists
      const { data: existingFeedback } = await supabase
        .from('ad_feedback')
        .select('id')
        .eq('user_id', user.id)
        .eq('primary_text', primaryText || '')
        .eq('headline', headline || '')
        .single();

      const feedbackData = {
        user_id: user.id,
        rating: parseInt(rating, 10),
        feedback,
        saved_images: [image.url],
        primary_text: primaryText || null,
        headline: headline || null,
        created_at: new Date().toISOString(),
        project_id: isValidUUID ? projectId : null
      };

      let saveError;
      
      if (existingFeedback) {
        // Update existing feedback
        const { error: updateError } = await supabase
          .from('ad_feedback')
          .update(feedbackData)
          .eq('id', existingFeedback.id);
          
        saveError = updateError;
      } else {
        // Insert new feedback
        const { error: insertError } = await supabase
          .from('ad_feedback')
          .insert({
            id: uuidv4(),
            ...feedbackData
          });
          
        saveError = insertError;
      }

      if (saveError) throw saveError;

      onSaveSuccess();
      toast({
        title: "Success!",
        description: isValidUUID 
          ? "Your feedback has been saved and ad added to project."
          : "Your feedback has been saved.",
      });
    } catch (error) {
      console.error('[SaveAdButton] Error saving feedback:', error);
      toast({
        title: "Error",
        description: error instanceof Error 
          ? `Failed to save: ${error.message}`
          : "Failed to save feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      console.log('[SaveAdButton] Save operation completed');
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
        "Saving..."
      ) : (
        <>
          <Save className="w-4 h-4 mr-2" />
          Save Ad
        </>
      )}
    </Button>
  );
};