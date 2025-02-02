import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { Json } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

const calculateHighestStep = (data: any): number => {
  let step = 1;
  if (data?.business_idea) step = Math.max(step, 2);
  if (data?.target_audience) step = Math.max(step, 3);
  if (data?.audience_analysis) step = Math.max(step, 4);
  return step;
};

const backupAnonymousData = async (sessionId: string, userId: string): Promise<boolean> => {
  try {
    const { data: anonymousData } = await supabase
      .from('anonymous_usage')
      .select('wizard_data')
      .eq('session_id', sessionId)
      .single();

    if (anonymousData?.wizard_data) {
      await supabase
        .from('data_backups')
        .insert({
          data: JSON.stringify(anonymousData.wizard_data),
          backup_type: 'manual',
          metadata: { session_id: sessionId },
          user_id: userId
        });
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Migration] Backup error:', error);
    return false;
  }
};

export const migrateUserProgress = async (
  user_id: string,
  session_id: string
): Promise<WizardData | null> => {
  console.log('[Migration] Starting migration for user:', user_id);

  try {
    // First backup the anonymous data
    const backupSuccess = await backupAnonymousData(session_id, user_id);
    if (!backupSuccess) {
      console.warn('[Migration] Failed to backup anonymous data');
    }

    // Check for existing lock with retry mechanism
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    while (retryCount < maxRetries) {
      const { data: existingLock } = await supabase
        .from('migration_locks')
        .select('*')
        .eq('user_id', user_id)
        .single();

      if (!existingLock) {
        break;
      }

      console.log(`[Migration] Lock exists, retry ${retryCount + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount)));
      retryCount++;
    }

    if (retryCount === maxRetries) {
      throw new Error('Migration lock timeout');
    }

    // Create a migration lock
    const { error: lockError } = await supabase
      .from('migration_locks')
      .insert({
        user_id,
        lock_type: 'wizard_migration',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        metadata: { session_id }
      });

    if (lockError) {
      console.error('[Migration] Error creating migration lock:', lockError);
      throw lockError;
    }

    // Get anonymous data and calculate step
    const { data: anonymousData } = await supabase
      .from('anonymous_usage')
      .select('wizard_data, last_completed_step')
      .eq('session_id', session_id)
      .single();

    if (!anonymousData) {
      console.log('[Migration] No anonymous data found');
      return null;
    }

    const calculatedStep = calculateHighestStep(anonymousData.wizard_data);
    const finalStep = Math.max(
      calculatedStep,
      anonymousData.last_completed_step || 1
    );

    // Call atomic_migration with explicit parameters and error handling
    const { data, error } = await supabase
      .rpc('atomic_migration', { 
        p_user_id: user_id, 
        p_session_id: session_id,
        p_calculated_step: finalStep
      });

    if (error) {
      console.error('[Migration] Database error:', error);
      toast({
        title: "Migration Error",
        description: "Failed to migrate your progress. Please try again.",
        variant: "destructive",
      });
      throw error;
    }

    // Update anonymous usage record with status
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
    await supabase
      .from('migration_locks')
      .delete()
      .eq('user_id', user_id);

    console.log('[Migration] Migration completed successfully');
    
    // Convert and validate the data
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
    
    toast({
      title: "Migration Failed",
      description: "There was an error migrating your data. Please try again.",
      variant: "destructive",
    });
    
    throw error;
  }
};