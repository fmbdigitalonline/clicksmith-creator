import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import logger from "@/utils/logger";
import { PostgrestError } from "@supabase/supabase-js";

const MAX_ANONYMOUS_SAVES = 3;
const SAVE_COOLDOWN = 5000; // 5 seconds

export const saveWizardData = async (
  userId?: string,
  sessionId?: string,
  data?: WizardData
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (userId) {
      return saveAuthenticatedData(userId, data as WizardData);
    } else if (sessionId) {
      return saveAnonymousData(sessionId, data as WizardData);
    }
    return { success: false, error: "No user ID or session ID provided" };
  } catch (error) {
    logger.error("Error in saveWizardData:", { error: String(error) });
    return { success: false, error: "Failed to save wizard data" };
  }
};

export const createDataBackup = async (userId: string, data: WizardData) => {
  try {
    const backupData = {
      user_id: userId,
      data: JSON.stringify(data),
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'wizard_progress',
        version: '1.0'
      },
      backup_type: 'auto'
    };

    const { error } = await supabase
      .from('data_backups')
      .insert([backupData]);

    if (error) {
      logger.error("Failed to create data backup:", { 
        details: { 
          error: error.message,
          code: error.code 
        }
      });
    }
  } catch (error) {
    logger.error("Error in createDataBackup:", { 
      details: { error: String(error) } 
    });
  }
};

const saveAuthenticatedData = async (
  userId: string,
  data: WizardData
): Promise<{ success: boolean; error?: string }> => {
  try {
    await createDataBackup(userId, data);

    const wizardData = {
      user_id: userId,
      business_idea: data.business_idea,
      target_audience: data.target_audience,
      audience_analysis: data.audience_analysis,
      selected_hooks: data.selected_hooks,
      current_step: data.current_step || 1,
      version: (data.version || 0) + 1,
      last_save_attempt: new Date().toISOString()
    };

    const { error } = await supabase
      .from('wizard_progress')
      .upsert(wizardData, {
        onConflict: 'user_id'
      });

    if (error) {
      logger.error("Failed to save wizard progress:", { 
        details: { 
          error: error.message,
          code: error.code 
        }
      });
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("Error in saveAuthenticatedData:", { 
      details: { error: String(error) } 
    });
    return { success: false, error: "Failed to save data" };
  }
};

const saveAnonymousData = async (
  sessionId: string,
  data: WizardData
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: usage, error: fetchError } = await supabase
      .from('anonymous_usage')
      .select('save_count, last_save_attempt')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (fetchError) {
      logger.error("Error fetching anonymous usage:", { 
        details: { 
          error: fetchError.message,
          code: fetchError.code 
        }
      });
      return { success: false, error: "Failed to check anonymous usage" };
    }

    const now = new Date();
    const lastSaveAttempt = usage?.last_save_attempt ? new Date(usage.last_save_attempt) : null;
    const saveCount = usage?.save_count || 0;

    if (lastSaveAttempt && (now.getTime() - lastSaveAttempt.getTime()) < SAVE_COOLDOWN) {
      return { success: false, error: "Please wait before saving again" };
    }

    if (saveCount >= MAX_ANONYMOUS_SAVES) {
      return { success: false, error: "Maximum saves reached for anonymous session" };
    }

    const { error: upsertError } = await supabase
      .from('anonymous_usage')
      .upsert({
        session_id: sessionId,
        wizard_data: {
          ...data,
          last_updated: now.toISOString()
        },
        save_count: saveCount + 1,
        last_save_attempt: now.toISOString()
      });

    if (upsertError) {
      logger.error("Failed to save anonymous data:", { 
        details: { 
          error: upsertError.message,
          code: upsertError.code 
        }
      });
      return { success: false, error: upsertError.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("Error in saveAnonymousData:", { 
      details: { error: String(error) } 
    });
    return { success: false, error: "Failed to save anonymous data" };
  }
};

export const performMaintenance = async () => {
  const { error } = await supabase.rpc('cleanup_stale_locks');
  if (error) {
    logger.error("Failed to cleanup stale locks:", { 
      details: { 
        error: error.message,
        code: error.code 
      }
    });
  }
};