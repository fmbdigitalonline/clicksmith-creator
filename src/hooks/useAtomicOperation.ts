import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useAtomicOperation = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const executeAtomically = useCallback(async <T>(
    operation: () => Promise<T>,
    lockKey: string,
    retryCount = 0
  ): Promise<T | null> => {
    if (isProcessing) {
      console.log('[AtomicOperation] Operation already in progress');
      return null;
    }

    let lockAcquired = false;
    try {
      setIsProcessing(true);
      console.log(`[AtomicOperation] Acquiring lock for: ${lockKey}`);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User must be authenticated');
      }

      // Try to acquire lock
      const { data: lock, error: lockError } = await supabase
        .from('migration_locks')
        .insert({
          user_id: user.id,
          lock_type: lockKey,
          expires_at: new Date(Date.now() + 30000).toISOString()
        })
        .select()
        .single();

      if (lockError) {
        if (retryCount < 3) {
          console.log(`[AtomicOperation] Lock acquisition failed, retrying (${retryCount + 1}/3)`);
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          return executeAtomically(operation, lockKey, retryCount + 1);
        }
        throw new Error('Failed to acquire lock after retries');
      }

      lockAcquired = true;
      console.log('[AtomicOperation] Lock acquired, executing operation');
      const result = await operation();

      return result;
    } catch (error) {
      console.error('[AtomicOperation] Error:', error);
      toast({
        title: "Operation failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      return null;
    } finally {
      if (lockAcquired) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          await supabase
            .from('migration_locks')
            .delete()
            .eq('user_id', user.id)
            .eq('lock_type', lockKey);
        }
      }
      setIsProcessing(false);
      console.log('[AtomicOperation] Lock released');
    }
  }, [isProcessing, toast]);

  return {
    executeAtomically,
    isProcessing
  };
};