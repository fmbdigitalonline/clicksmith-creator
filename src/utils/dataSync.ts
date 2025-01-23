import { supabase } from "@/integrations/supabase/client";
import { validateWizardData } from "./validation";
import logger from "./logger";
import type { LogContext } from "./logger";
import { encryptData } from "./encryption";
import { WizardData } from "@/types/wizardProgress";
import { Json } from "@/integrations/supabase/types";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;
const MAX_ANONYMOUS_SAVES = 10;
const SAVE_RATE_LIMIT = 5000; // 5 seconds

interface WizardData {
  current_step?: number;
  business_idea?: Record<string, any> | null;
  target_audience?: Record<string, any> | null;
  audience_analysis?: Record<string, any> | null;
  selected_hooks?: Record<string, any>[] | null;
  generated_ads?: Record<string, any>[] | null;
  version?: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async <T>(
  operation: () => Promise<T>,
  attempts: number = MAX_RETRY_ATTEMPTS
): Promise<T> => {
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === attempts - 1) throw error;
      await delay(RETRY_DELAY * (i + 1));
    }
  }
  throw new Error('All retry attempts failed');
};

export const createDataBackup = async (userId: string, data: WizardData): Promise<boolean> => {
  try {
    const encryptedData = await encryptData(JSON.stringify(data));
    const metadata = {
      timestamp: new Date().toISOString(),
      version: data.version || 1,
      type: 'auto'
    };

    const jsonData: Json = {
      ...data,
      business_idea: data.business_idea || null,
      target_audience: data.target_audience || null,
      selected_hooks: data.selected_hooks || null,
      generated_ads: data.generated_ads || null,
      current_step: data.current_step || 1,
      version: data.version || 1
    };

    await retryOperation(async () => {
      const { error } = await supabase
        .from('data_backups')
        .insert({
          user_id: userId,
          data: encryptedData,
          metadata,
          backup_type: 'auto'
        });

      if (error) throw error;
    });

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

export const syncWizardProgress = async (userId: string, data: WizardData): Promise<{ success: boolean; error?: string }> => {
  const lockId = await acquireMigrationLock(userId, 'wizard_sync');
  if (!lockId) {
    return { success: false, error: 'Failed to acquire lock' };
  }

  try {
    if (!validateWizardData(data)) {
      throw new Error('Invalid wizard data format');
    }

    await createDataBackup(userId, data);

    const wizardData = {
      user_id: userId,
      ...data,
      version: (data.version || 0) + 1,
      updated_at: new Date().toISOString()
    };

    await retryOperation(async () => {
      const { error } = await supabase
        .from('wizard_progress')
        .upsert(wizardData, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    });

    logger.info('Wizard progress synced successfully', {
      component: 'dataSync',
      action: 'syncWizardProgress',
      userId
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
  } finally {
    await releaseMigrationLock(lockId);
  }
};

export const handleAnonymousSave = async (sessionId: string, data: WizardData): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: usage, error: usageError } = await supabase
      .from('anonymous_usage')
      .select('save_count, last_save_attempt')
      .eq('session_id', sessionId)
      .single();

    if (usageError) throw usageError;

    const now = new Date();
    const lastSave = usage?.last_save_attempt ? new Date(usage.last_save_attempt) : null;
    
    if (lastSave && (now.getTime() - lastSave.getTime()) < SAVE_RATE_LIMIT) {
      return { success: false, error: 'Please wait before saving again' };
    }

    if (usage?.save_count >= MAX_ANONYMOUS_SAVES) {
      return { success: false, error: 'Maximum saves reached for anonymous session' };
    }

    const { error: saveError } = await supabase
      .from('anonymous_usage')
      .update({
        wizard_data: data,
        save_count: (usage?.save_count || 0) + 1,
        last_save_attempt: now.toISOString()
      })
      .eq('session_id', sessionId);

    if (saveError) throw saveError;

    return { success: true };
  } catch (error) {
    logger.error('Failed to handle anonymous save', {
      component: 'dataSync',
      action: 'handleAnonymousSave',
      error
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Cleanup function to be called periodically
export const performMaintenance = async () => {
  await cleanupStaleLocks();
};
