import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useAdGenerationLock = () => {
  const [isLocked, setIsLocked] = useState(false);
  const { toast } = useToast();
  const [retryCount, setRetryCount] = useState(0);

  const acquireLock = useCallback(async () => {
    if (isLocked) {
      console.log('[WizardLock] Already locked');
      return false;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[WizardLock] No user found');
        return false;
      }

      const { data, error } = await supabase
        .from('migration_locks')
        .insert([{
          user_id: user.id,
          lock_type: 'wizard_progress',
          expires_at: new Date(Date.now() + 30000).toISOString() // 30 second lock
        }])
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned is okay here
          setIsLocked(true);
          return true;
        }
        console.error('[WizardLock] Error acquiring lock:', error);
        return false;
      }

      if (data) {
        setIsLocked(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[WizardLock] Unexpected error:', error);
      return false;
    }
  }, [isLocked]);

  const releaseLock = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('migration_locks')
        .delete()
        .eq('user_id', user.id)
        .eq('lock_type', 'wizard_progress');

      if (error && error.code !== 'PGRST116') {
        console.error('[WizardLock] Error releasing lock:', error);
        return;
      }

      setIsLocked(false);
    } catch (error) {
      console.error('[WizardLock] Error releasing lock:', error);
    }
  }, []);

  const canRetry = useCallback(() => {
    return retryCount < 3;
  }, [retryCount]);

  const incrementRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    return retryCount + 1;
  }, [retryCount]);

  return {
    isLocked,
    acquireLock,
    releaseLock,
    canRetry,
    incrementRetry,
    retryCount
  };
};