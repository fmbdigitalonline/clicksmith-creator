import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useMigrationLock = (userId: string | undefined) => {
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkLock = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: lock, error } = await supabase
          .from('migration_locks')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          console.error('[MigrationLock] Error checking lock:', error);
          toast({
            title: "Error checking migration status",
            description: "Please try again",
            variant: "destructive",
          });
          return;
        }

        setIsLocked(!!lock);
      } catch (error) {
        console.error('[MigrationLock] Unexpected error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkLock();
  }, [userId, toast]);

  return { isLocked, isLoading };
};