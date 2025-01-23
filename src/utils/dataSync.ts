import { supabase } from "@/integrations/supabase/client";
import { validateWizardData } from "./validation";
import { handleError } from "./errorBoundary";

export const syncWizardProgress = async (userId: string, data: any) => {
  try {
    if (!validateWizardData(data)) {
      throw new Error('Invalid wizard data format');
    }

    const { error } = await supabase
      .from('wizard_progress')
      .upsert({
        user_id: userId,
        ...data,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;

    return true;
  } catch (error) {
    handleError(error as Error, 'syncWizardProgress');
    return false;
  }
};

export const migrateAnonymousData = async (sessionId: string, userId: string) => {
  try {
    // Start transaction
    const { data: anonymousData, error: fetchError } = await supabase
      .from('anonymous_usage')
      .select('wizard_data')
      .eq('session_id', sessionId)
      .single();

    if (fetchError) throw fetchError;

    if (!anonymousData?.wizard_data) {
      console.log('[Migration] No anonymous data found to migrate');
      return true;
    }

    // Validate data before migration
    if (!validateWizardData(anonymousData.wizard_data)) {
      throw new Error('Invalid anonymous data format');
    }

    // Migrate to user account
    const { error: migrationError } = await supabase
      .from('wizard_progress')
      .upsert({
        user_id: userId,
        ...anonymousData.wizard_data,
        updated_at: new Date().toISOString()
      });

    if (migrationError) throw migrationError;

    // Clean up anonymous data
    const { error: cleanupError } = await supabase
      .from('anonymous_usage')
      .delete()
      .eq('session_id', sessionId);

    if (cleanupError) {
      console.error('[Migration] Cleanup error:', cleanupError);
      // Don't throw here as the migration was successful
    }

    return true;
  } catch (error) {
    handleError(error as Error, 'migrateAnonymousData');
    return false;
  }
};