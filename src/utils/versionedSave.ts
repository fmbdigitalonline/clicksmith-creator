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
    // First check if a record exists and get its current version
    const { data: existing, error: fetchError } = await supabase
      .from('wizard_progress')
      .select('version')
      .eq('user_id', data.user_id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // If no existing record, create new one
    if (!existing) {
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

    // If version mismatch and under retry limit, wait and retry
    if (existing.version !== version && retryCount < MAX_RETRIES) {
      console.log(`[versionedSave] Version mismatch, retrying (${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => 
        setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount))
      );
      return saveWizardState(data, existing.version, retryCount + 1);
    }

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
        console.log(`[versionedSave] Concurrent save detected, retrying (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => 
          setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount))
        );
        return saveWizardState(data, version, retryCount + 1);
      }
      throw error;
    }

    if (!result) {
      throw new Error('Failed to update wizard progress - version mismatch');
    }

    return {
      success: true,
      newVersion: result.version
    };
  } catch (error) {
    console.error('[versionedSave] Error saving wizard state:', error);
    throw error;
  }
};