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

    if (validProjectId) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('generated_ads')
        .eq('id', validProjectId)
        .single();

      if (projectError) {
        console.error('Error fetching project:', projectError);
        throw projectError;
      }

      const existingAds = ((project?.generated_ads as SavedAdJson[]) || []).map(ad => ({
        image: ad.image as AdImage,
        hook: ad.hook as AdHook,
        rating: ad.rating as number,
        feedback: ad.feedback as string,
        savedAt: ad.savedAt as string,
      }));

      const newAd: SavedAd = {
        image,
        hook,
        rating: parseInt(rating, 10),
        feedback,
        savedAt: new Date().toISOString()
      };

      const jsonAds: SavedAdJson[] = [...existingAds, newAd].map(ad => ({
        image: ad.image as Json,
        hook: ad.hook as Json,
        rating: ad.rating as Json,
        feedback: ad.feedback as Json,
        savedAt: ad.savedAt as Json,
      }));

      const { error: updateError } = await supabase
        .from('projects')
        .update({
          generated_ads: jsonAds
        })
        .eq('id', validProjectId);

      if (updateError) {
        console.error('Error updating project:', updateError);
        throw updateError;
      }
    } else if (projectId === "new") {
      return {
        success: false,
        message: "No Project Selected",
        shouldCreateProject: true
      };
    }

    const baseFeedbackData = {
      id: uuidv4(),
      user_id: user.id,
      rating: parseInt(rating, 10),
      feedback,
      saved_images: [image.url],
      primary_text: primaryText || null,
      headline: headline || null,
      created_at: new Date().toISOString()
    };

    const feedbackData = validProjectId 
      ? { ...baseFeedbackData, project_id: validProjectId }
      : baseFeedbackData;

    const { error: feedbackError } = await supabase
      .from('ad_feedback')
      .insert(feedbackData);

    if (feedbackError) {
      console.error('Error saving feedback:', feedbackError);
      throw feedbackError;
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