import { supabase } from "@/integrations/supabase/client";
import { AdHook, AdImage } from "@/types/adWizard";
import { useToast } from "@/hooks/use-toast";

interface SaveAdParams {
  image: AdImage;
  primaryText: string;
  headline: string;
  projectId?: string;
  rating?: string;
  feedback?: string;
  hook?: AdHook;
}

interface SaveAdResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  shouldCreateProject?: boolean;
}

export const saveAd = async ({
  image,
  primaryText,
  headline,
  projectId,
  rating,
  feedback,
  hook,
}: SaveAdParams): Promise<SaveAdResponse> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {
        success: false,
        error: 'User must be logged in to save ad',
        message: 'Please log in to save ads'
      };
    }

    const isValidUUID = projectId && 
                       projectId !== "new" && 
                       /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId);

    // Check for existing feedback first
    const { data: existingFeedback } = await supabase
      .from('ad_feedback')
      .select('*')
      .eq('user_id', user.id)
      .eq('project_id', isValidUUID ? projectId : null)
      .eq('primary_text', primaryText)
      .eq('headline', headline)
      .maybeSingle();

    // If feedback exists, update it
    if (existingFeedback) {
      const { data: updatedFeedback, error: updateError } = await supabase
        .from('ad_feedback')
        .update({
          rating: rating ? Math.max(1, Math.min(5, parseInt(rating, 10))) : existingFeedback.rating,
          feedback: feedback || existingFeedback.feedback,
          saved_images: image ? [image] : existingFeedback.saved_images,
          project_data: {
            hook,
            image
          }
        })
        .eq('id', existingFeedback.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return { 
        success: true, 
        data: updatedFeedback,
        message: 'Ad feedback updated successfully'
      };
    }

    // If no existing feedback, insert new
    const { data: newFeedback, error: insertError } = await supabase
      .from('ad_feedback')
      .insert({
        user_id: user.id,
        project_id: isValidUUID ? projectId : null,
        rating: rating ? Math.max(1, Math.min(5, parseInt(rating, 10))) : null,
        feedback,
        saved_images: image ? [image] : [],
        primary_text: primaryText,
        headline: headline,
        project_data: {
          hook,
          image
        }
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.message.includes('project_id')) {
        return {
          success: false,
          error: insertError.message,
          message: 'Please create a project first',
          shouldCreateProject: true
        };
      }
      throw insertError;
    }

    return { 
      success: true, 
      data: newFeedback,
      message: 'Ad feedback saved successfully'
    };

  } catch (error) {
    console.error('Error in saveAd:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save ad',
      message: 'Failed to save ad'
    };
  }
};