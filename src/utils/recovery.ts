import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const sessionRecovery = {
  async cleanOrphanedSessions() {
    try {
      console.log('[Recovery] Starting orphaned sessions cleanup...');
      
      // Clean up expired anonymous sessions
      const { data: orphanedSessions, error: fetchError } = await supabase
        .from('anonymous_usage')
        .select('session_id')
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Sessions older than 24h
        .eq('used', false);

      if (fetchError) {
        console.error('[Recovery] Error fetching orphaned sessions:', fetchError);
        return;
      }

      if (orphanedSessions?.length) {
        console.log('[Recovery] Found orphaned sessions:', orphanedSessions.length);
        
        const { error: deleteError } = await supabase
          .from('anonymous_usage')
          .update({ used: true })
          .in('session_id', orphanedSessions.map(s => s.session_id));

        if (deleteError) {
          console.error('[Recovery] Error marking orphaned sessions:', deleteError);
        }
      }
    } catch (error) {
      console.error('[Recovery] Unexpected error during cleanup:', error);
    }
  },

  async resetLocalState() {
    try {
      console.log('[Recovery] Resetting local state...');
      
      // Clear local storage items
      localStorage.removeItem('anonymous_session_id');
      sessionStorage.removeItem('pending_migration');
      
      // Reset navigation state
      window.history.replaceState({}, document.title, window.location.pathname);
      
      console.log('[Recovery] Local state reset complete');
    } catch (error) {
      console.error('[Recovery] Error resetting local state:', error);
    }
  },

  async recoverWizardProgress(userId: string) {
    try {
      console.log('[Recovery] Attempting to recover wizard progress for user:', userId);
      
      // Check for existing wizard progress
      const { data: existingProgress, error: progressError } = await supabase
        .from('wizard_progress')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (progressError && progressError.code !== 'PGRST116') {
        console.error('[Recovery] Error checking wizard progress:', progressError);
        return null;
      }

      if (existingProgress) {
        console.log('[Recovery] Found existing wizard progress');
        return existingProgress;
      }

      // If no progress found, check for anonymous data
      const sessionId = localStorage.getItem('anonymous_session_id');
      if (!sessionId) {
        console.log('[Recovery] No anonymous session found');
        return null;
      }

      const { data: anonymousData, error: anonError } = await supabase
        .from('anonymous_usage')
        .select('wizard_data')
        .eq('session_id', sessionId)
        .single();

      if (anonError) {
        console.error('[Recovery] Error fetching anonymous data:', anonError);
        return null;
      }

      if (anonymousData?.wizard_data) {
        console.log('[Recovery] Found anonymous data, attempting recovery');
        
        // Create new wizard progress from anonymous data
        const { data: newProgress, error: insertError } = await supabase
          .from('wizard_progress')
          .insert({
            user_id: userId,
            ...anonymousData.wizard_data,
            is_migration: true,
            version: 1
          })
          .select()
          .single();

        if (insertError) {
          console.error('[Recovery] Error creating new progress:', insertError);
          return null;
        }

        return newProgress;
      }

      return null;
    } catch (error) {
      console.error('[Recovery] Unexpected error during recovery:', error);
      return null;
    }
  }
};

export const useErrorRecovery = () => {
  const { toast } = useToast();

  const handleRecoveryError = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const recoveredProgress = await sessionRecovery.recoverWizardProgress(user.id);
        
        if (recoveredProgress) {
          toast({
            title: "Progress Recovered",
            description: "Your previous work has been restored.",
          });
          return recoveredProgress;
        }
      }
      
      await sessionRecovery.resetLocalState();
      
      toast({
        title: "Error Recovery",
        description: "Your session has been reset. Please try again.",
        variant: "destructive",
      });
      
      return null;
    } catch (error) {
      console.error('[ErrorRecovery] Failed to handle error:', error);
      toast({
        title: "Recovery Failed",
        description: "Please refresh the page and try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  return { handleRecoveryError };
};