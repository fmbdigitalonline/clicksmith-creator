import { supabase } from "@/integrations/supabase/client";
import { AdHook, AdImage } from "@/types/adWizard";
import { SavedAd, SavedAdJson } from "@/types/savedAd";
import { Json } from "@/integrations/supabase/types";

interface SaveAdParams {
  image: AdImage;
  hook: AdHook;
  rating: string;
  feedback: string;
  projectId?: string;
  primaryText?: string;
  headline?: string;
}

interface SaveAdResult {
  success: boolean;
  message: string;
  shouldCreateProject?: boolean;
}

export const saveAd = async (params: SaveAdParams): Promise<SaveAdResult> => {
  const { image, hook, rating, feedback, projectId, primaryText, headline } = params;

  if (!rating) {
    return {
      success: false,
      message: "Please provide a rating before saving."
    };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {
        success: false,
        message: "User must be logged in to save feedback"
      };
    }

    const isValidUUID = projectId && 
                       projectId !== "new" && 
                       /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId);

    // Insert feedback with atomic operation
    const { data: savedFeedback, error: insertError } = await supabase
      .from('ad_feedback')
      .insert({
        user_id: user.id,
        project_id: isValidUUID ? projectId : null,
        rating: Math.max(1, Math.min(5, parseInt(rating, 10))), // Ensure rating is between 1-5
        feedback,
        saved_images: [image.url],
        primary_text: primaryText,
        headline,
        project_data: {
          hook,
          image
        }
      })
      .select()
      .maybeSingle(); // Changed from single() to maybeSingle()

    if (insertError) {
      console.error('Error saving ad feedback:', insertError);
      throw insertError;
    }

    return {
      success: true,
      message: isValidUUID 
        ? "Your feedback has been saved and ad added to project."
        : "Your feedback has been saved."
    };

  } catch (error) {
    console.error('Error saving ad:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to save feedback."
    };
  }
};