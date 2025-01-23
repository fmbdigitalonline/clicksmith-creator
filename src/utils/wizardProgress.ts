import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const saveWizardProgress = async (data: any, projectId: string | undefined) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const sessionId = localStorage.getItem('anonymous_session_id');

    // Handle anonymous users
    if (!user && sessionId) {
      console.log('Saving progress for anonymous user:', { sessionId, data });
      
      // Add retry logic for anonymous users
      let retries = 3;
      while (retries > 0) {
        try {
          const { error: anonymousError } = await supabase
            .from('anonymous_usage')
            .upsert({
              session_id: sessionId,
              wizard_data: {
                ...data,
                updated_at: new Date().toISOString()
              },
              version: (data.version || 0) + 1
            }, {
              onConflict: 'session_id'
            });

          if (!anonymousError) {
            return;
          }
          
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw anonymousError;
          }
        } catch (error) {
          if (retries === 0) throw error;
        }
      }
    }

    // Handle authenticated users
    if (user) {
      if (projectId && projectId !== 'new') {
        const { error } = await supabase
          .from('projects')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
            version: (data.version || 0) + 1
          })
          .eq('id', projectId);

        if (error) throw error;
      } else {
        // Add retry logic for wizard progress
        let retries = 3;
        while (retries > 0) {
          try {
            const { error } = await supabase
              .from('wizard_progress')
              .upsert(
                {
                  user_id: user.id,
                  ...data,
                  updated_at: new Date().toISOString(),
                  version: (data.version || 0) + 1
                },
                {
                  onConflict: 'user_id',
                  ignoreDuplicates: false
                }
              );

            if (!error) {
              break;
            }

            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              throw error;
            }
          } catch (error) {
            if (retries === 0) throw error;
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Error saving progress:', error);
    
    // Only show toast for non-concurrent save errors
    if (!error.message?.includes('Concurrent save detected')) {
      toast({
        title: "Error saving progress",
        description: error instanceof Error ? error.message : "Failed to save progress",
        variant: "destructive",
      });
    }
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