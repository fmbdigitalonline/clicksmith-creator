import { supabase } from "@/integrations/supabase/client";
import { AdHook, AdImage } from "@/types/adWizard";
import { SavedAd, SavedAdJson } from "@/types/savedAd";
import { Json } from "@/integrations/supabase/types";
import { v4 as uuidv4 } from 'uuid';

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
    const validProjectId = isValidUUID ? projectId : null;

    // Start a transaction using RPC
    const { data: result, error: rpcError } = await supabase.rpc('save_ad_with_feedback', {
      p_user_id: user.id,
      p_project_id: validProjectId,
      p_rating: parseInt(rating, 10),
      p_feedback: feedback,
      p_saved_images: [image.url],
      p_primary_text: primaryText,
      p_headline: headline,
      p_hook: hook,
      p_image: image
    });

    if (rpcError) {
      console.error('Error in save_ad_with_feedback RPC:', rpcError);
      throw rpcError;
    }

    return {
      success: true,
      message: validProjectId 
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