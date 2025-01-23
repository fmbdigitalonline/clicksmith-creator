import { supabase } from "@/integrations/supabase/client";
import { validateWizardData } from "./validation";
import logger from "./logger";
import type { LogContext } from "./logger";
import { encryptData, decryptData } from "./encryption";

interface BackupMetadata {
  timestamp: string;
  version: number;
  type: 'auto' | 'manual';
}

interface SyncResult {
  success: boolean;
  error?: string;
}

export const createDataBackup = async (userId: string, data: Record<string, any>): Promise<boolean> => {
  try {
    const encryptedData = await encryptData(JSON.stringify(data));
    const metadata: BackupMetadata = {
      timestamp: new Date().toISOString(),
      version: 1,
      type: 'auto'
    };

    const { error } = await supabase
      .from('data_backups')
      .insert({
        user_id: userId,
        data: encryptedData,
        metadata,
        backup_type: 'auto'
      });

    if (error) throw error;
    
    logger.info('Data backup created successfully', {
      component: 'dataSync',
      action: 'createDataBackup',
      userId
    });

    return true;
  } catch (error) {
    logger.error('Failed to create data backup', {
      component: 'dataSync',
      action: 'createDataBackup',
      error
    });
    return false;
  }
};

export const restoreFromBackup = async (userId: string, backupId: string): Promise<Record<string, any> | null> => {
  try {
    const { data, error } = await supabase
      .from('data_backups')
      .select('data')
      .eq('user_id', userId)
      .eq('id', backupId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const decryptedData = await decryptData(data.data);
    return JSON.parse(decryptedData);
  } catch (error) {
    logger.error('Failed to restore from backup', {
      component: 'dataSync',
      action: 'restoreFromBackup',
      error
    });
    return null;
  }
};

export const syncWizardProgress = async (userId: string, data: Record<string, any>): Promise<SyncResult> => {
  try {
    if (!validateWizardData(data)) {
      throw new Error('Invalid wizard data format');
    }

    // Create a backup before syncing
    await createDataBackup(userId, data);

    const wizardData = {
      user_id: userId,
      current_step: data.current_step || 1,
      business_idea: data.business_idea || null,
      target_audience: data.target_audience || null,
      audience_analysis: data.audience_analysis || null,
      selected_hooks: data.selected_hooks || null,
      ad_format: data.ad_format || null,
      video_ad_preferences: data.video_ad_preferences || null,
      generated_ads: data.generated_ads || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('wizard_progress')
      .upsert(wizardData, {
        onConflict: 'user_id'
      });

    if (error) throw error;

    logger.info('Wizard progress synced successfully', {
      component: 'dataSync',
      action: 'syncWizardProgress',
      userId,
      details: { dataKeys: Object.keys(data) }
    } as LogContext);

    return { success: true };
  } catch (error) {
    logger.error('Failed to sync wizard progress', {
      component: 'dataSync',
      action: 'syncWizardProgress',
      error,
      userId
    } as LogContext);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

export const migrateAnonymousData = async (sessionId: string, userId: string): Promise<SyncResult> => {
  try {
    const { data: anonymousData, error: fetchError } = await supabase
      .from('anonymous_usage')
      .select('wizard_data')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!anonymousData?.wizard_data) {
      logger.info('No anonymous data found to migrate', {
        component: 'dataSync',
        action: 'migrateAnonymousData',
        userId
      });
      return { success: true };
    }

    if (!validateWizardData(anonymousData.wizard_data)) {
      throw new Error('Invalid anonymous data format');
    }

    const wizardData = {
      user_id: userId,
      current_step: anonymousData.wizard_data.current_step || 1,
      business_idea: anonymousData.wizard_data.business_idea || null,
      target_audience: anonymousData.wizard_data.target_audience || null,
      audience_analysis: anonymousData.wizard_data.audience_analysis || null,
      selected_hooks: anonymousData.wizard_data.selected_hooks || null,
      ad_format: anonymousData.wizard_data.ad_format || null,
      video_ad_preferences: anonymousData.wizard_data.video_ad_preferences || null,
      generated_ads: anonymousData.wizard_data.generated_ads || null,
      updated_at: new Date().toISOString()
    };

    const { error: migrationError } = await supabase
      .from('wizard_progress')
      .upsert(wizardData);

    if (migrationError) throw migrationError;

    const { error: cleanupError } = await supabase
      .from('anonymous_usage')
      .delete()
      .eq('session_id', sessionId);

    if (cleanupError) {
      logger.warn('Failed to cleanup anonymous data', {
        component: 'dataSync',
        action: 'migrateAnonymousData',
        error: cleanupError,
        userId
      });
    }

    logger.info('Anonymous data migrated successfully', {
      component: 'dataSync',
      action: 'migrateAnonymousData',
      userId
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to migrate anonymous data', {
      component: 'dataSync',
      action: 'migrateAnonymousData',
      error,
      userId
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};