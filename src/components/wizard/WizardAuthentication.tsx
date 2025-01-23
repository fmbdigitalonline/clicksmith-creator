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
            console.log('[WizardAuthentication] Found anonymous session data to migrate:', sessionId);
            
            const migrationLock = localStorage.getItem('migration_in_progress');
            if (migrationLock) {
              console.log('[WizardAuthentication] Migration already in progress');
              return;
            }
            
            localStorage.setItem('migration_in_progress', 'true');

            try {
              const { data: anonData, error: anonError } = await supabase
                .from('anonymous_usage')
                .select('wizard_data, completed')
                .eq('session_id', sessionId)
                .maybeSingle();

              if (anonError) {
                console.error('[WizardAuthentication] Error fetching anonymous data:', anonError);
                return;
              }

              if (anonData?.wizard_data) {
                console.log('[WizardAuthentication] Migrating anonymous data:', anonData.wizard_data);
                onAnonymousDataChange(anonData.wizard_data);
              }

              localStorage.removeItem('anonymous_session_id');
              localStorage.removeItem('migration_in_progress');
            } catch (error) {
              console.error('[WizardAuthentication] Migration error:', error);
              localStorage.removeItem('migration_in_progress');
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