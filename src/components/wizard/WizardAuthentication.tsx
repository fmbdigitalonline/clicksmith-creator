import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  const navigate = useNavigate();
  const location = useLocation();

  const redirectToStep = (step: number) => {
    console.log('[Auth] Redirecting to step:', step);

    // For new registrations, ensure they continue from at least step 3
    const isNewRegistration = location.state?.from === '/login';
    const targetStep = isNewRegistration ? Math.max(step, 3) : step;

    if (!targetStep || targetStep < 1) {
      console.log('[Auth] Invalid step value:', targetStep);
      return;
    }

    if (targetStep > 1) {
      console.log('[Auth] Navigating to step:', targetStep);
      navigate(`/ad-wizard/new`, { state: { step: targetStep } });
    } else {
      console.log('[Auth] No valid step found, staying on current page');
    }
  };

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    let isCheckingUser = false;

    const checkUser = async () => {
      if (isCheckingUser) {
        console.log('[Auth] User check already in progress');
        return;
      }

      isCheckingUser = true;

      try {
        console.log('[Auth] Starting user check');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (sessionError) {
          console.error('[Auth] Session error:', sessionError);
          throw sessionError;
        }

        if (session?.user) {
          console.log('[Auth] Found authenticated user:', session.user.id);
          onUserChange(session.user);

          const { data: existing } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

          const sessionId = localStorage.getItem('anonymous_session_id');
          if (sessionId) {
            console.log('[Auth] Found anonymous session:', sessionId);

            const { data: anonymousData } = await supabase
              .from('anonymous_usage')
              .select('wizard_data')
              .eq('session_id', sessionId)
              .maybeSingle();

            if (anonymousData?.wizard_data) {
              console.log('[Auth] Found anonymous progress, starting migration');
              try {
                const migratedData = await migrateUserProgress(session.user.id, sessionId);
                if (migratedData) {
                  console.log('[Auth] Migration successful:', migratedData);
                  onAnonymousDataChange(migratedData);
                  localStorage.removeItem('anonymous_session_id');

                  // Use the migrated step or existing step, whichever is higher
                  const step = Math.max(migratedData.current_step || existing?.current_step || 1, 3);
                  console.log('[Auth] Redirecting to step after migration:', step);
                  redirectToStep(step);

                  toast({
                    title: "Progress Restored",
                    description: "Your previous work has been saved to your account.",
                  });
                }
              } catch (error) {
                console.error('[Auth] Migration error:', error);
                toast({
                  title: "Error Restoring Progress",
                  description: "There was an error restoring your previous work. You may need to start over.",
                  variant: "destructive",
                });
              }
            }
          } else if (existing) {
            console.log('[Auth] Found existing progress for user:', session.user.id);
            console.log('[Auth] Current step:', existing.current_step);
            onAnonymousDataChange(existing as WizardData);

            if (existing.current_step && existing.current_step > 1) {
              redirectToStep(existing.current_step);
            }
          }
        }

        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          console.log('[Auth] Found anonymous session:', sessionId);

          const { data: anonymousData, error: anonError } = await supabase
            .from('anonymous_usage')
            .select('wizard_data')
            .eq('session_id', sessionId)
            .maybeSingle();

          if (anonError && anonError.code !== 'PGRST116') {
            console.error('[Auth] Error fetching anonymous data:', anonError);
            throw anonError;
          }

          if (anonymousData?.wizard_data) {
            console.log('[Auth] Found anonymous progress');
            onAnonymousDataChange(anonymousData.wizard_data as WizardData);
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
      } finally {
        isCheckingUser = false;
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth state changed:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        onUserChange(session.user);

        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          try {
            console.log('[Auth] Starting migration after sign in');
            const migratedData = await migrateUserProgress(session.user.id, sessionId);
            if (migratedData) {
              console.log('[Auth] Migration successful after sign in:', migratedData);
              onAnonymousDataChange(migratedData);
              localStorage.removeItem('anonymous_session_id');

              // Use the migrated step or existing step, whichever is higher
              const step = Math.max(migratedData.current_step || 1, 3);
              console.log('[Auth] Redirecting to step after sign in:', step);
              redirectToStep(step);

              toast({
                title: "Progress Migrated",
                description: "Your previous work has been saved to your account.",
              });
            }
          } catch (error) {
            console.error('[Auth] Migration error:', error);
            toast({
              title: "Migration Error",
              description: "There was an error migrating your progress. You may need to start over.",
              variant: "destructive",
            });
          }
        }
      } else if (event === 'SIGNED_OUT') {
        onUserChange(null);
      }
    });

    checkUser();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [onUserChange, onAnonymousDataChange, toast, navigate, location.state]);

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
