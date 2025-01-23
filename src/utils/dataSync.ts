import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import logger from "@/utils/logger";

const MAX_ANONYMOUS_SAVES = 3;
const SAVE_COOLDOWN = 5000; // 5 seconds

export const saveWizardData = async (
  data: WizardData,
  userId?: string | null,
  sessionId?: string | null
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (userId) {
      return await saveAuthenticatedData(userId, data);
    } else if (sessionId) {
      return await saveAnonymousData(sessionId, data);
    }
    return { success: false, error: "No user ID or session ID provided" };
  } catch (error) {
    logger.error("Error in saveWizardData:", error);
    return { success: false, error: "Failed to save wizard data" };
  }
};

const createDataBackup = async (userId: string, data: WizardData) => {
  try {
    const backupData = {
      user_id: userId,
      data: JSON.stringify(data),
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'auto'
      }
    };

    const wizardData = {
      business_idea: data.business_idea || null,
      target_audience: data.target_audience || null,
      audience_analysis: data.audience_analysis || null,
      selected_hooks: data.selected_hooks || null,
      generated_ads: data.generated_ads || null,
      current_step: data.current_step || 1,
      version: data.version || 1
    };

    const { error } = await supabase
      .from('data_backups')
      .insert([backupData]);

    if (error) {
      logger.error("Failed to create data backup:", error);
    }
  } catch (error) {
    logger.error("Error in createDataBackup:", error);
  }
};

const saveAuthenticatedData = async (
  userId: string,
  data: WizardData
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Create backup first
    await createDataBackup(userId, data);

    const wizardData = {
      user_id: userId,
      business_idea: data.business_idea || null,
      target_audience: data.target_audience || null,
      audience_analysis: data.audience_analysis || null,
      selected_hooks: data.selected_hooks || null,
      generated_ads: data.generated_ads || null,
      current_step: data.current_step || 1,
      version: data.version || 1,
      last_save_attempt: new Date().toISOString()
    };

    const { error } = await supabase
      .from('wizard_progress')
      .upsert([wizardData], {
        onConflict: 'user_id'
      });

    if (error) {
      logger.error("Failed to save wizard progress:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("Error in saveAuthenticatedData:", error);
    return { success: false, error: "Failed to save data" };
  }
};

const saveAnonymousData = async (
  sessionId: string,
  data: WizardData
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if this session exists and hasn't exceeded save limit
    const { data: usage, error: fetchError } = await supabase
      .from('anonymous_usage')
      .select('save_count, last_save_attempt')
      .eq('session_id', sessionId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error("Error fetching anonymous usage:", fetchError);
      return { success: false, error: "Failed to check anonymous usage" };
    }

    const lastSaveAttempt = usage?.last_save_attempt ? new Date(usage.last_save_attempt) : null;
    const now = new Date();
    
    if (lastSaveAttempt && (now.getTime() - lastSaveAttempt.getTime()) < SAVE_COOLDOWN) {
      return { success: false, error: 'Please wait before saving again' };
    }

    if (usage?.save_count >= MAX_ANONYMOUS_SAVES) {
      return { success: false, error: 'Maximum saves reached for anonymous session' };
    }

    const wizardData = {
      business_idea: data.business_idea || null,
      target_audience: data.target_audience || null,
      audience_analysis: data.audience_analysis || null,
      selected_hooks: data.selected_hooks || null,
      generated_ads: data.generated_ads || null,
      current_step: data.current_step || 1
    };

    const { error: upsertError } = await supabase
      .from('anonymous_usage')
      .upsert([{
        session_id: sessionId,
        wizard_data: wizardData,
        save_count: (usage?.save_count || 0) + 1,
        last_save_attempt: now.toISOString()
      }], {
        onConflict: 'session_id'
      });

    if (upsertError) {
      logger.error("Failed to save anonymous data:", upsertError);
      return { success: false, error: upsertError.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("Error in saveAnonymousData:", error);
    return { success: false, error: "Failed to save anonymous data" };
  }
};

export const performMaintenance = async () => {
  const { error } = await supabase.rpc('cleanup_stale_locks');
  if (error) {
    logger.error("Failed to cleanup stale locks:", error);
  }
};