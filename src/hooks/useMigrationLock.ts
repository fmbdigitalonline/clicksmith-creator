import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useMigrationLock = (userId: string | undefined) => {
  const [isLocked, setIsLocked] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkMigrationLock = async () => {
      if (!userId) return;

      try {
        const { data, error } = await supabase
          .from('migration_locks')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          console.error('[useMigrationLock] Error checking lock:', error);
          return;
        }

        setIsLocked(!!data);
      } catch (error) {
        console.error('[useMigrationLock] Unexpected error:', error);
        toast({
          title: "Error",
          description: "Failed to check migration status",
          variant: "destructive",
        });
      }
    };

    checkMigrationLock();
  }, [userId]);

  return { isLocked };
};