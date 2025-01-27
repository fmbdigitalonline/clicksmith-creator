import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { useToast } from "@/hooks/use-toast";

const RETRY_DELAY = 1000; // Base delay in milliseconds
const MAX_RETRIES = 3;

export const saveWizardState = async (
  data: Partial<WizardData> & { user_id: string },
  version: number,
  retryCount = 0
): Promise<{ success: boolean; newVersion: number }> => {
  console.log('[versionedSave] Starting save with version:', version);
  
  try {
    // First check if a record exists
    const { data: existing } = await supabase
      .from('wizard_progress')
      .select('version')
      .eq('user_id', data.user_id)
      .maybeSingle();

    if (existing) {
      // Update existing record with version check
      const { data: result, error } = await supabase
        .from('wizard_progress')
        .update({
          ...data,
          version: version + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', data.user_id)
        .eq('version', version) // Only update if version matches
        .select()
        .single();

      if (error) {
        if (error.message === 'Concurrent save detected' && retryCount < MAX_RETRIES) {
          console.log(`[versionedSave] Retry attempt ${retryCount + 1}/${MAX_RETRIES}`);
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount))
          );
          
          // Get latest version before retrying
          const { data: latest } = await supabase
            .from('wizard_progress')
            .select('version')
            .eq('user_id', data.user_id)
            .maybeSingle();
            
          return saveWizardState(data, latest?.version || version, retryCount + 1);
        }
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
          ...data,
          version: 1
        })
        .select()
        .single();

      if (error) throw error;

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