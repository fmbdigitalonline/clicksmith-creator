import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";

interface MigrationPayload {
  userId: string;
  sessionId: string;
  force?: boolean;
}

interface MigrationResult {
  success: boolean;
  data?: WizardData;
  error?: string;
}

const isWizardData = (data: any): data is WizardData => {
  return typeof data === 'object' && data !== null;
};

export class MigrationService {
  private static LOCK_DURATION = 5000; // 5-second lock
  private static MAX_RETRIES = 3;
  private static MIGRATION_LOCKS = new Set<string>();
  
  async migrateProgress({ userId, sessionId, force = false }: MigrationPayload): Promise<MigrationResult> {
    console.log('[MigrationService] Starting migration:', { userId, sessionId, force });
    
    if (MigrationService.MIGRATION_LOCKS.has(userId)) {
      console.log('[MigrationService] Migration already in progress for:', userId);
      return {
        success: false,
        error: 'Migration already in progress'
      };
    }

    MigrationService.MIGRATION_LOCKS.add(userId);
    let retryCount = 0;
    
    try {
      while (retryCount < MigrationService.MAX_RETRIES) {
        try {
          const { data: lock, error: lockError } = await supabase
            .from('wizard_progress')
            .update({ 
              migration_token: uuidv4(),
              is_migration: true,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .is('migration_token', null)
            .select()
            .single();

          if (lockError && !force) {
            console.error('[MigrationService] Lock acquisition failed:', lockError);
            return {
              success: false,
              error: 'Migration already in progress'
            };
          }

          const { data: anonymousData, error: anonError } = await supabase
            .from('anonymous_usage')
            .select('wizard_data')
            .eq('session_id', sessionId)
            .single();

          if (anonError) {
            console.error('[MigrationService] Anonymous data fetch failed:', anonError);
            throw new Error('Failed to fetch anonymous data');
          }

          if (!anonymousData?.wizard_data || !isWizardData(anonymousData.wizard_data)) {
            console.log('[MigrationService] No valid anonymous data found');
            return {
              success: false,
              error: 'No valid anonymous data found'
            };
          }

          const validatedData = this.validateData(anonymousData.wizard_data);
          
          await supabase
            .from('anonymous_usage')
            .update({ 
              used: true,
              completed: true,
              last_save_attempt: new Date().toISOString()
            })
            .eq('session_id', sessionId);

          const { error: updateError } = await supabase
            .from('wizard_progress')
            .upsert({
              ...validatedData,
              user_id: userId,
              migration_token: null,
              is_migration: true,
              updated_at: new Date().toISOString()
            });

          if (updateError) {
            console.error('[MigrationService] Progress update failed:', updateError);
            throw updateError;
          }

          console.log('[MigrationService] Migration completed successfully');
          return {
            success: true,
            data: validatedData
          };

        } catch (error) {
          console.error('[MigrationService] Migration attempt failed:', error);
          retryCount++;
          
          if (retryCount === MigrationService.MAX_RETRIES) {
            await this.releaseLock(userId);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Migration failed'
            };
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      return {
        success: false,
        error: 'Maximum retry attempts exceeded'
      };
    } finally {
      MigrationService.MIGRATION_LOCKS.delete(userId);
    }
  }

  private async releaseLock(userId: string): Promise<void> {
    try {
      await supabase
        .from('wizard_progress')
        .update({ 
          migration_token: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } catch (error) {
      console.error('[MigrationService] Failed to release lock:', error);
    }
  }

  private validateData(data: WizardData): WizardData {
    console.log('[MigrationService] Validating data:', data);
    
    // Calculate actual completed step based on data presence
    let validatedStep = 1;
    
    // Check if business_idea exists and has content
    if (data.business_idea && typeof data.business_idea === 'object') {
      validatedStep = 2;
    }
    
    // Check if target_audience exists and has content
    if (validatedStep === 2 && data.target_audience && typeof data.target_audience === 'object') {
      validatedStep = 3;
    }
    
    // Check if audience_analysis exists and has content
    if (validatedStep === 3 && data.audience_analysis && typeof data.audience_analysis === 'object') {
      validatedStep = 4;
    }

    // Ensure the current_step doesn't exceed the validated step
    const maxStep = Math.min(validatedStep, data.current_step || 1);

    return {
      ...data,
      business_idea: validatedStep >= 1 ? data.business_idea : null,
      target_audience: validatedStep >= 2 ? data.target_audience : null,
      audience_analysis: validatedStep >= 3 ? data.audience_analysis : null,
      current_step: maxStep,
      version: (data.version || 0) + 1,
      updated_at: new Date().toISOString()
    };
  }
}

export const migrationService = new MigrationService();