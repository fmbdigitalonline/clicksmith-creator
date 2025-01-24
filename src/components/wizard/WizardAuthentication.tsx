import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WizardAuthenticationProps {
  onUserChange: (user: any) => void;
  onAnonymousDataChange: (data: any) => void;
}

const WizardAuthentication = ({ onUserChange, onAnonymousDataChange }: WizardAuthenticationProps) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    
    const checkUser = async () => {
      try {
        console.log('[WizardAuthentication] Starting user check...');
        const { data: { user }, error: sessionError } = await supabase.auth.getUser();
        
        if (sessionError) {
          console.error('[WizardAuthentication] Session error:', sessionError);
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(checkUser, 1000 * retryCount);
            return;
          }
          setAuthError(sessionError.message);
          return;
        }

        if (!isMounted) return;
        onUserChange(user);
        setAuthError(null);

        if (user) {
          const sessionId = localStorage.getItem('anonymous_session_id');
          if (sessionId) {
            console.log('[WizardAuthentication] Found anonymous session to migrate:', sessionId);
            
            try {
              // First, get the anonymous data
              const { data: anonData, error: anonError } = await supabase
                .from('anonymous_usage')
                .select('wizard_data, completed')
                .eq('session_id', sessionId)
                .single();

              if (anonError) {
                console.error('[WizardAuthentication] Error fetching anonymous data:', anonError);
                return;
              }

              if (anonData?.wizard_data) {
                console.log('[WizardAuthentication] Migrating data:', anonData.wizard_data);
                
                // Insert into wizard_progress
                const { error: wizardError } = await supabase
                  .from('wizard_progress')
                  .upsert({
                    user_id: user.id,
                    business_idea: anonData.wizard_data.business_idea,
                    target_audience: anonData.wizard_data.target_audience,
                    generated_ads: anonData.wizard_data.generated_ads || [],
                    current_step: anonData.wizard_data.current_step || 4,
                    version: 1
                  });

                if (wizardError) {
                  console.error('[WizardAuthentication] Error migrating to wizard_progress:', wizardError);
                  toast({
                    title: "Migration Error",
                    description: "There was an error saving your progress. Please try again.",
                    variant: "destructive",
                  });
                  return;
                }

                // Mark anonymous session as used
                const { error: updateError } = await supabase
                  .from('anonymous_usage')
                  .update({ used: true })
                  .eq('session_id', sessionId);

                if (updateError) {
                  console.error('[WizardAuthentication] Error marking session as used:', updateError);
                }

                onAnonymousDataChange(anonData.wizard_data);
                localStorage.removeItem('anonymous_session_id');
                
                toast({
                  title: "Progress Migrated",
                  description: "Your previous work has been saved to your account.",
                });
              }
            } catch (error) {
              console.error('[WizardAuthentication] Migration error:', error);
              toast({
                title: "Migration Error",
                description: "Failed to migrate your previous work. Please try again.",
                variant: "destructive",
              });
            }
          }
        }
      } catch (error) {
        console.error('[WizardAuthentication] Error in checkUser:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(checkUser, 1000 * retryCount);
        } else {
          setAuthError('Failed to check authentication status. Please refresh the page.');
        }
      }
    };

    checkUser();
    return () => {
      isMounted = false;
    };
  }, [onUserChange, onAnonymousDataChange, toast]);

  if (authError) {
    return (
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
        {authError}
      </div>
    );
  }

  return null;
};

export default WizardAuthentication;