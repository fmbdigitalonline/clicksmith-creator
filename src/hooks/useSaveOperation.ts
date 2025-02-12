import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAtomicOperation } from './useAtomicOperation';
import { WizardData } from '@/types/wizardProgress';

export const useSaveOperation = () => {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { executeAtomically } = useAtomicOperation();

  const saveWizardState = async (data: Partial<WizardData> & { user_id: string }) => {
    if (isSaving) {
      console.log('[SaveOperation] Save already in progress');
      return null;
    }

    setIsSaving(true);
    console.log('[SaveOperation] Starting save operation:', { userId: data.user_id });

    try {
      const result = await executeAtomically(async () => {
        const { data: existingData, error: fetchError } = await supabase
          .from('wizard_progress')
          .select('version')
          .eq('user_id', data.user_id)
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        const version = existingData?.version || 0;
        console.log('[SaveOperation] Current version:', version);

        const { data: savedData, error: saveError } = await supabase
          .from('wizard_progress')
          .upsert({
            ...data,
            version: version + 1,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (saveError) {
          if (saveError.message.includes('Concurrent save detected')) {
            throw new Error('Another save operation is in progress. Please try again.');
          }
          throw saveError;
        }

        return savedData;
      }, `save_wizard_${data.user_id}`);

      console.log('[SaveOperation] Save completed successfully:', result);
      toast({
        title: "Progress Saved",
        description: "Your progress has been saved successfully.",
      });

      return result;
    } catch (error) {
      console.error('[SaveOperation] Error saving state:', error);
      toast({
        title: "Error Saving Progress",
        description: error instanceof Error ? error.message : "Failed to save progress",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    saveWizardState,
    isSaving
  };
};