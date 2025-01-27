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
        ...data,
        version: currentVersion + 1,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
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