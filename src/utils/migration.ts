import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";

export const migrateUserProgress = async (
  user_id: string,
  session_id: string
): Promise<WizardData | null> => {
  let isMigrating = false;

  if (isMigrating) {
    console.log('[Migration] Already in progress');
    return null;
  }

  isMigrating = true;
  try {
    console.log('[Migration] Starting migration for user:', user_id);
    
    // First get the anonymous data
    const { data: anonymousData, error: anonError } = await supabase
      .from('anonymous_usage')
      .select('wizard_data, last_completed_step')
      .eq('session_id', session_id)
      .maybeSingle();

    if (anonError) {
      console.error('[Migration] Error fetching anonymous data:', anonError);
      throw anonError;
    }

    if (!anonymousData?.wizard_data) {
      console.log('[Migration] No anonymous data found');
      return null;
    }

    // Update wizard progress with atomic migration
    const { data, error } = await supabase
      .rpc('atomic_migration', { 
        p_user_id: user_id, 
        p_session_id: session_id
      });

    if (error) {
      console.error('[Migration] Database error:', error);
      throw error;
    }

    if (!data) {
      console.log('[Migration] No data to migrate');
      return null;
    }

    // Mark anonymous session as used
    await supabase
      .from('anonymous_usage')
      .update({ 
        used: true,
        completed: true,
        last_completed_step: Math.max(
          data.current_step || 1,
          anonymousData.last_completed_step || 1
        )
      })
      .eq('session_id', session_id);

    console.log('[Migration] Successfully migrated data:', data);
    return data as WizardData;
  } catch (error) {
    console.error('[Migration] Error:', error);
    return null;
  } finally {
    isMigrating = false;
    console.log('[Migration] Migration lock released');
  }
};