import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";

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
    const { data: existing, error: fetchError } = await supabase
      .from('wizard_progress')
      .select('version')
      .eq('user_id', data.user_id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

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
        .eq('version', version)
        .select('version')
        .maybeSingle();

      if (error) {
        if (error.message.includes('Concurrent save detected') && retryCount < MAX_RETRIES) {
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

      if (!result) {
        // If no result, the version didn't match - get current version and retry
        const { data: current } = await supabase
          .from('wizard_progress')
          .select('version')
          .eq('user_id', data.user_id)
          .maybeSingle();

        if (current && retryCount < MAX_RETRIES) {
          return saveWizardState(data, current.version, retryCount + 1);
        }
        
        throw new Error('Failed to update wizard progress - version mismatch');
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
          version: 1,
          current_step: data.current_step || 1
        })
        .select('version')
        .maybeSingle();

      if (error) throw error;
      
      if (!result) {
        throw new Error('Failed to create wizard progress');
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