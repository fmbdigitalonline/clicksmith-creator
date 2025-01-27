import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";

export const saveWizardState = async (
  data: Partial<WizardData>,
  currentVersion: number
): Promise<{ success: boolean; newVersion: number }> => {
  try {
    const { data: result, error } = await supabase
      .from('wizard_progress')
      .upsert({
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
        user_id: data.user_id,
        is_migration: data.is_migration || false
      })
      .select('version')
      .single();

    if (error) throw error;
    
    return { 
      success: true, 
      newVersion: result?.version || currentVersion + 1 
    };
  } catch (error) {
    console.error('[versionedSave] Error saving wizard state:', error);
    return { success: false, newVersion: currentVersion };
  }
};