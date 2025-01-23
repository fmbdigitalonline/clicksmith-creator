import { supabase } from "@/integrations/supabase/client";
import { validateWizardData } from "./validation";
import logger from "./logger";

interface SyncResult {
  success: boolean;
  error?: string;
}

export const syncWizardProgress = async (userId: string, data: Record<string, any>): Promise<SyncResult> => {
  try {
    if (!validateWizardData(data)) {
      throw new Error('Invalid wizard data format');
    }

    const { error } = await supabase
      .from('wizard_progress')
      .upsert({
        user_id: userId,
        ...data,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;

    logger.info('Wizard progress synced successfully', {
      component: 'dataSync',
      action: 'syncWizardProgress',
      userId,
      details: { dataKeys: Object.keys(data) }
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to sync wizard progress', {
      component: 'dataSync',
      action: 'syncWizardProgress',
      error,
      userId
    });
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
      .single();

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

    const { error: migrationError } = await supabase
      .from('wizard_progress')
      .upsert({
        user_id: userId,
        ...anonymousData.wizard_data,
        updated_at: new Date().toISOString()
      });

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