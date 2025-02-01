import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useWizardLock = () => {
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

      // First check if a lock already exists
      const { data: existingLock, error: checkError } = await supabase
        .from('migration_locks')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();  // Changed from single() to maybeSingle()

      if (checkError && !checkError.message.includes('PGRST116')) {
        console.error('[WizardLock] Error checking lock:', checkError);
        return false;
      }

      // If lock exists and hasn't expired, return false
      if (existingLock && new Date(existingLock.expires_at) > new Date()) {
        console.log('[WizardLock] Lock already exists and is valid');
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
        .maybeSingle();  // Changed from single() to maybeSingle()

      if (error) {
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

      if (error && !error.message.includes('PGRST116')) {
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