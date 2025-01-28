import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";

const calculateHighestStep = (data: any): number => {
  let highestStep = 1;
  
  // Check business idea (Step 1)
  if (data.business_idea) highestStep = Math.max(highestStep, 1);
  
  // Check target audience (Step 2)
  if (data.target_audience) highestStep = Math.max(highestStep, 2);
  
  // Check audience analysis (Step 3)
  if (data.audience_analysis) highestStep = Math.max(highestStep, 3);
  
  // Check generated ads (Step 4)
  if (data.generated_ads && data.generated_ads.length > 0) {
    highestStep = Math.max(highestStep, 4);
  }
  
  return highestStep;
};

export const migrateUserProgress = async (
  user_id: string,
  session_id: string
): Promise<WizardData | null> => {
  const migrationKey = `migration_${user_id}_${session_id}`;
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

    // Calculate the highest possible step based on available data
    const calculatedStep = calculateHighestStep(anonymousData.wizard_data);
    
    // Use atomic migration with existing parameters
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

    // Update the current_step after migration if needed
    if (calculatedStep > (data.current_step || 1)) {
      await supabase
        .from('wizard_progress')
        .update({ current_step: calculatedStep })
        .eq('user_id', user_id);
    }

    // Mark anonymous session as used
    await supabase
      .from('anonymous_usage')
      .update({ 
        used: true,
        completed: true,
        last_completed_step: Math.max(
          data.current_step || 1,
          calculatedStep,
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