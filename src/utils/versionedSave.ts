import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";

export const saveWizardState = async (
  data: Partial<WizardData> & { user_id: string },
  version: number
): Promise<{ success: boolean; newVersion: number }> => {
  console.log('[versionedSave] Starting save with version:', version);

  try {
    // First check if a record exists
    const { data: existing } = await supabase
      .from('wizard_progress')
      .select('id, version, business_idea, target_audience, audience_analysis')
      .eq('user_id', data.user_id)
      .maybeSingle();

    if (existing) {
      // Update existing record, preserving existing data if not provided in update
      const { data: result, error } = await supabase
        .from('wizard_progress')
        .update({
          business_idea: data.business_idea || existing.business_idea,
          target_audience: data.target_audience || existing.target_audience,
          audience_analysis: data.audience_analysis || existing.audience_analysis,
          current_step: data.current_step || 1,
          generated_ads: data.generated_ads || [],
          selected_hooks: data.selected_hooks || null,
          ad_format: data.ad_format || null,
          video_ad_preferences: data.video_ad_preferences || null,
          version: version,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', data.user_id)
        .select()
        .single();

      if (error) {
        console.error('[versionedSave] Error saving wizard state:', error);
        throw error;
      }

      return {
        success: true,
        newVersion: result.version
      };
    } else {
      // Insert new record
      const { data: result, error } = await supabase
        .from('wizard_progress')
        .insert({
          user_id: data.user_id,
          business_idea: data.business_idea || null,
          target_audience: data.target_audience || null,
          audience_analysis: data.audience_analysis || null,
          current_step: data.current_step || 1,
          generated_ads: data.generated_ads || [],
          selected_hooks: data.selected_hooks || null,
          ad_format: data.ad_format || null,
          video_ad_preferences: data.video_ad_preferences || null,
          version: 1
        })
        .select()
        .single();

      if (error) {
        console.error('[versionedSave] Error saving wizard state:', error);
        throw error;
      }

      return {
        success: true,
        newVersion: 1
      };
    }
  } catch (error) {
    console.error('[versionedSave] Error saving wizard state:', error);
    throw error;
  }
};