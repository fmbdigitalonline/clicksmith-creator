import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { Json } from "@/integrations/supabase/types";

const calculateHighestStep = (data: any): number => {
  let step = 1;
  if (data?.business_idea) step = Math.max(step, 2);
  if (data?.target_audience) step = Math.max(step, 3);
  if (data?.audience_analysis) step = Math.max(step, 4);
  return step;
};

export const migrateUserProgress = async (
  user_id: string,
  session_id: string
): Promise<WizardData | null> => {
  console.log('[Migration] Starting migration for user:', user_id);

  try {
    // First check if a migration is already in progress
    const { data: existingLock, error: lockError } = await supabase
      .from('migration_locks')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();  // Changed from single() to maybeSingle()

    if (lockError && !lockError.message.includes('PGRST116')) {
      console.error('[Migration] Error checking lock:', lockError);
      return null;
    }

    if (existingLock) {
      console.log('[Migration] Migration already in progress');
      return null;
    }

    // Create a migration lock with proper date format
    const { error: lockError2 } = await supabase
      .from('migration_locks')
      .insert({
        user_id,
        lock_type: 'wizard_migration',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        metadata: {}
      });

    if (lockError2) {
      console.error('[Migration] Error creating migration lock:', lockError2);
      return null;
    }

    // Get anonymous data first to calculate the step
    const { data: anonymousData, error: anonError } = await supabase
      .from('anonymous_usage')
      .select('wizard_data, last_completed_step')
      .eq('session_id', session_id)
      .maybeSingle();  // Changed from single() to maybeSingle()

    if (anonError && !anonError.message.includes('PGRST116')) {
      console.error('[Migration] Error fetching anonymous data:', anonError);
      return null;
    }

    if (!anonymousData) {
      console.log('[Migration] No anonymous data found');
      return null;
    }

    // Calculate the highest step based on data
    const calculatedStep = calculateHighestStep(anonymousData.wizard_data);
    const finalStep = Math.max(
      calculatedStep,
      anonymousData.last_completed_step || 1
    );

    // Call atomic_migration with explicit parameters
    const { data, error } = await supabase
      .rpc('atomic_migration', { 
        p_user_id: user_id, 
        p_session_id: session_id,
        p_calculated_step: finalStep
      });

    if (error) {
      console.error('[Migration] Database error:', error);
      throw error;
    }

    // Update the anonymous usage record
    const { error: updateError } = await supabase
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

    if (updateError) {
      console.error('[Migration] Error updating anonymous usage:', updateError);
    }

    // Clean up the migration lock
    const { error: cleanupError } = await supabase
      .from('migration_locks')
      .delete()
      .eq('user_id', user_id);

    if (cleanupError) {
      console.error('[Migration] Error cleaning up migration lock:', cleanupError);
    }

    console.log('[Migration] Migration lock released');
    
    // Convert the data to match WizardData type with proper type handling
    const wizardData: WizardData = {
      ...data,
      generated_ads: Array.isArray(data.generated_ads) ? data.generated_ads : [],
      selected_hooks: Array.isArray(data.selected_hooks) 
        ? data.selected_hooks.map((hook: Json) => typeof hook === 'object' ? hook : {})
        : [],
      business_idea: data.business_idea || null,
      target_audience: data.target_audience || null,
      audience_analysis: data.audience_analysis || null,
      ad_format: data.ad_format || null,
      video_ad_preferences: data.video_ad_preferences || null,
      current_step: data.current_step || 1,
      version: data.version || 1
    };

    return wizardData;
  } catch (error) {
    console.error('[Migration] Error:', error);
    // Clean up the migration lock in case of error
    await supabase
      .from('migration_locks')
      .delete()
      .eq('user_id', user_id);
    throw error;
  }
};