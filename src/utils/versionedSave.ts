import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";

export const saveWizardState = async (
  data: Partial<WizardData>,
  currentVersion: number
): Promise<{ success: boolean; newVersion: number }> => {
  try {
    console.log('[versionedSave] Starting save with version:', currentVersion);
    
    // First check if a record exists
    const { data: existing } = await supabase
      .from('wizard_progress')
      .select('id, version')
      .eq('user_id', data.user_id)
      .maybeSingle();

    if (existing) {
      // Update existing record
      const { data: result, error } = await supabase
        .from('wizard_progress')
        .update({
          business_idea: data.business_idea || null,
          target_audience: data.target_audience || null,
          audience_analysis: data.audience_analysis || null,
          current_step: data.current_step || 1,
          generated_ads: data.generated_ads || [],
          selected_hooks: data.selected_hooks || null,
          ad_format: data.ad_format || null,
          video_ad_preferences: data.video_ad_preferences || null,
          version: currentVersion + 1,
          updated_at: new Date().toISOString(),
          is_migration: data.is_migration || false
        })
        .eq('id', existing.id)
        .select('version')
        .maybeSingle();

      if (error) throw error;
      
      return { 
        success: true, 
        newVersion: result?.version || currentVersion + 1 
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
          version: 1,
          is_migration: data.is_migration || false
        })
        .select('version')
        .maybeSingle();

      if (error) throw error;
      
      return { 
        success: true, 
        newVersion: result?.version || 1 
      };
    }
  } catch (error) {
    console.error('[versionedSave] Error saving wizard state:', error);
    return { success: false, newVersion: currentVersion };
  }
};