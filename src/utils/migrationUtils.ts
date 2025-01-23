import { supabase } from "@/integrations/supabase/client";
import logger from "./logger";
import { v4 as uuidv4 } from 'uuid';

const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export const acquireMigrationLock = async (userId: string, lockType: string) => {
  try {
    const lockId = uuidv4();
    const expiresAt = new Date(Date.now() + LOCK_TIMEOUT);

    const { error } = await supabase
      .from('migration_locks')
      .insert({
        id: lockId,
        user_id: userId,
        lock_type: lockType,
        expires_at: expiresAt.toISOString(),
        metadata: { started_at: new Date().toISOString() }
      });

    if (error) throw error;
    return lockId;
  } catch (error) {
    logger.error('Failed to acquire migration lock', {
      component: 'migrationUtils',
      action: 'acquireMigrationLock',
      error
    });
    return null;
  }
};

export const releaseMigrationLock = async (lockId: string) => {
  try {
    const { error } = await supabase
      .from('migration_locks')
      .delete()
      .eq('id', lockId);

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error('Failed to release migration lock', {
      component: 'migrationUtils',
      action: 'releaseMigrationLock',
      error
    });
    return false;
  }
};

export const cleanupStaleLocks = async () => {
  try {
    const { error } = await supabase.rpc('cleanup_stale_locks');
    if (error) throw error;
    return true;
  } catch (error) {
    logger.error('Failed to cleanup stale locks', {
      component: 'migrationUtils',
      action: 'cleanupStaleLocks',
      error
    });
    return false;
  }
};