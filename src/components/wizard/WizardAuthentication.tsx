import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { migrateUserProgress } from "@/utils/migration";
import { WizardData } from "@/types/wizardProgress";

interface WizardAuthenticationProps {
  onUserChange: (user: any) => void;
  onAnonymousDataChange: (data: WizardData) => void;
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
        console.log('[Auth] Starting user check');
        const { data: { user }, error } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (error) {
          console.error('[Auth] Error:', error);
          throw error;
        }

        if (!user) {
          console.log('[Auth] No authenticated user found (anonymous session)');
          return;
        }

        onUserChange(user);
        
        // Pre-check: Does the user already have progress?
        const { data: existing } = await supabase
          .from('wizard_progress')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          onAnonymousDataChange(existing as WizardData);
          localStorage.removeItem('anonymous_session_id');
          return;
        }

        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          console.log('[Migration] Starting migration process');
          try {
            const migratedData = await migrateUserProgress(user.id, sessionId);

            if (migratedData) {
              onAnonymousDataChange(migratedData);
              localStorage.removeItem('anonymous_session_id');
              toast({
                title: "Progress Migrated",
                description: "Your previous work has been saved to your account.",
              });
            }
          } catch (error) {
            console.error('[Migration] Error:', error);
            // Fallback to existing data if migration fails
            if (existing) {
              onAnonymousDataChange(existing as WizardData);
            }
          }
        }
      } catch (error) {
        console.error('[Auth] Error:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(checkUser, 1000 * retryCount);
        } else {
          setAuthError('Authentication check failed. Please refresh.');
          toast({
            title: "Authentication Error",
            description: "Failed to check authentication status. Please refresh the page.",
            variant: "destructive",
          });
        }
      }
    };

    checkUser();
    return () => { isMounted = false; };
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