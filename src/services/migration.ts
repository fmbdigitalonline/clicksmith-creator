import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "@/types/wizardProgress";
import { useToast } from "@/hooks/use-toast";

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

export class MigrationService {
  private static LOCK_DURATION = 5000; // 5-second lock
  private static MAX_RETRIES = 3;
  
  async migrateProgress({ userId, sessionId, force = false }: MigrationPayload): Promise<MigrationResult> {
    console.log('[MigrationService] Starting migration:', { userId, sessionId, force });
    
    let retryCount = 0;
    
    while (retryCount < MigrationService.MAX_RETRIES) {
      try {
        // Acquire migration lock
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

        // Fetch anonymous data
        const { data: anonymousData, error: anonError } = await supabase
          .from('anonymous_usage')
          .select('wizard_data')
          .eq('session_id', sessionId)
          .single();

        if (anonError) {
          console.error('[MigrationService] Anonymous data fetch failed:', anonError);
          throw new Error('Failed to fetch anonymous data');
        }

        if (!anonymousData?.wizard_data) {
          console.log('[MigrationService] No anonymous data found');
          return {
            success: false,
            error: 'No anonymous data found'
          };
        }

        // Validate and transform data
        const validatedData = this.validateData(anonymousData.wizard_data);
        
        // Mark anonymous session as used
        await supabase
          .from('anonymous_usage')
          .update({ 
            used: true,
            completed: true,
            last_save_attempt: new Date().toISOString()
          })
          .eq('session_id', sessionId);

        // Update wizard progress
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
          // Release lock on final failure
          await this.releaseLock(userId);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Migration failed'
          };
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    return {
      success: false,
      error: 'Maximum retry attempts exceeded'
    };
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
    
    // Determine the highest valid step based on data presence
    const maxStep = Math.min(
      data.audience_analysis ? 3 :
      data.target_audience ? 2 :
      data.business_idea ? 1 : 1,
      data.current_step || 1
    );

    return {
      ...data,
      current_step: maxStep,
      version: (data.version || 0) + 1,
      updated_at: new Date().toISOString()
    };
  }
}

// Create a singleton instance
export const migrationService = new MigrationService();