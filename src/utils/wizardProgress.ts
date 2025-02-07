import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const saveWizardProgress = async (data: any, projectId: string | undefined) => {
  console.group('[WizardProgress] Saving progress');
  console.log('Project ID:', projectId);
  console.log('Data:', data);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const sessionId = localStorage.getItem('anonymous_session_id');

    // Handle anonymous users
    if (!user && sessionId) {
      console.log('[WizardProgress] Saving progress for anonymous user:', { sessionId });
      const { error: anonymousError } = await supabase
        .from('anonymous_usage')
        .upsert({
          session_id: sessionId,
          wizard_data: {
            ...data,
            updated_at: new Date().toISOString()
          }
        }, {
          onConflict: 'session_id'
        });

      if (anonymousError) {
        console.error('[WizardProgress] Error saving anonymous progress:', anonymousError);
        throw anonymousError;
      }
      console.log('[WizardProgress] Anonymous progress saved successfully');
      console.groupEnd();
      return;
    }

    // Handle authenticated users
    if (user) {
      console.log('[WizardProgress] Saving progress for authenticated user:', user.id);
      
      if (projectId && projectId !== 'new') {
        console.log('[WizardProgress] Updating project:', projectId);
        const { error } = await supabase
          .from('projects')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('id', projectId);

        if (error) throw error;
        console.log('[WizardProgress] Project updated successfully');
      } else {
        console.log('[WizardProgress] Updating wizard progress');
        // Use upsert with on_conflict parameter
        const { error } = await supabase
          .from('wizard_progress')
          .upsert(
            {
              user_id: user.id,
              ...data,
              updated_at: new Date().toISOString()
            },
            {
              onConflict: 'user_id',
              ignoreDuplicates: false
            }
          );

        if (error) throw error;
        console.log('[WizardProgress] Wizard progress saved successfully');
      }

      console.log('[WizardProgress] Progress saved successfully:', data);
      console.groupEnd();
    }
  } catch (error) {
    console.error('[WizardProgress] Error saving progress:', error);
    console.groupEnd();
    toast({
      title: "Error saving progress",
      description: error instanceof Error ? error.message : "Failed to save progress",
      variant: "destructive",
    });
  }
};

export const clearWizardProgress = async (projectId: string | undefined, userId: string) => {
  console.group('[WizardProgress] Clearing progress');
  console.log('Project ID:', projectId);
  console.log('User ID:', userId);

  try {
    if (projectId && projectId !== 'new') {
      console.log('[WizardProgress] Clearing project data');
      const { error } = await supabase
        .from('projects')
        .update({
          business_idea: null,
          target_audience: null,
          audience_analysis: null,
          selected_hooks: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (error) throw error;
      console.log('[WizardProgress] Project data cleared successfully');
    } else {
      console.log('[WizardProgress] Clearing wizard progress');
      const { error } = await supabase
        .from('wizard_progress')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      console.log('[WizardProgress] Wizard progress cleared successfully');
    }

    console.groupEnd();
    return true;
  } catch (error) {
    console.error('[WizardProgress] Error clearing progress:', error);
    console.groupEnd();
    toast({
      title: "Error",
      description: "Failed to clear progress",
      variant: "destructive",
    });
    return false;
  }
};