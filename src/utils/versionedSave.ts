import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";

const RETRY_DELAY = 1000; // Base delay in milliseconds
const MAX_RETRIES = 3;

interface SaveResult {
  success: boolean;
  newVersion: number;
  error?: string;
  retryCount?: number;
}

export const saveWizardState = async (
  data: Partial<WizardData> & { user_id: string },
  version: number,
  retryCount = 0
): Promise<SaveResult> => {
  console.log('[versionedSave] Starting save with version:', version, 'retry:', retryCount);
  
  try {
    // First check if a record exists and get its current version
    const { data: existing, error: fetchError } = await supabase
      .from('wizard_progress')
      .select('version')
      .eq('user_id', data.user_id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[versionedSave] Error fetching existing record:', fetchError);
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

      if (error) {
        console.error('[versionedSave] Error creating new record:', error);
        throw error;
      }
      
      if (!result) {
        throw new Error('Failed to create wizard progress');
      }

      return {
        success: true,
        newVersion: 1
      };
    }

    // If version mismatch and under retry limit, wait and retry
    if (existing.version !== version) {
      console.warn(`[versionedSave] Version mismatch: expected ${version}, got ${existing.version}`);
      
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`[versionedSave] Retrying in ${delay}ms (${retryCount + 1}/${MAX_RETRIES})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return saveWizardState(data, existing.version, retryCount + 1);
      }
      
      throw new Error(`Version mismatch after ${MAX_RETRIES} retries`);
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
      if (error.message.includes('Concurrent save detected')) {
        console.warn('[versionedSave] Concurrent save detected');
        
        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`[versionedSave] Retrying in ${delay}ms (${retryCount + 1}/${MAX_RETRIES})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return saveWizardState(data, version, retryCount + 1);
        }
        
        throw new Error(`Failed to save after ${MAX_RETRIES} retries due to concurrent modifications`);
      }
      throw error;
    }

    if (!result) {
      throw new Error('Failed to update wizard progress - version mismatch');
    }

    return {
      success: true,
      newVersion: result.version,
      retryCount
    };
  } catch (error) {
    console.error('[versionedSave] Error saving wizard state:', error);
    
    return {
      success: false,
      newVersion: version,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      retryCount
    };
  }
};