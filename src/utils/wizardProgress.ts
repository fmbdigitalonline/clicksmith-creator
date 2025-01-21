import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const saveWizardProgress = async (data: any, projectId: string | undefined) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const sessionId = localStorage.getItem('anonymous_session_id');

    // Handle anonymous users
    if (!user && sessionId) {
      console.log('Saving progress for anonymous user:', { sessionId, data });
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
        console.error('Error saving anonymous progress:', anonymousError);
        throw anonymousError;
      }
      return;
    }

    // Handle authenticated users
    if (user) {
      if (projectId && projectId !== 'new') {
        const { error } = await supabase
          .from('projects')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('id', projectId);

        if (error) throw error;
      } else {
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
      }

      console.log('Progress saved successfully:', data);
    }
  } catch (error) {
    console.error('Error saving progress:', error);
    toast({
      title: "Error saving progress",
      description: error instanceof Error ? error.message : "Failed to save progress",
      variant: "destructive",
    });
  }
};

export const clearWizardProgress = async (projectId: string | undefined, userId: string) => {
  try {
    if (projectId && projectId !== 'new') {
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
    } else {
      const { error } = await supabase
        .from('wizard_progress')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error('Error clearing progress:', error);
    toast({
      title: "Error",
      description: "Failed to clear progress",
      variant: "destructive",
    });
    return false;
  }
};