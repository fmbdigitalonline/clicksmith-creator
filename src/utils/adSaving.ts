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

export const saveAd = async ({
  image,
  primaryText,
  headline,
  projectId,
  rating,
  feedback,
  hook,
}: SaveAdParams) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be logged in to save ad');
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
      return { success: true, data: updatedFeedback };
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

    if (insertError) throw insertError;
    return { success: true, data: newFeedback };

  } catch (error) {
    console.error('Error in saveAd:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save ad'
    };
  }
};