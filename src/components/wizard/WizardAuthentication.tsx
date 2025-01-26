import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

  const redirectToStep = (step: number) => {
    console.log('[Auth] Redirecting to step:', step);
    navigate(`/ad-wizard/step-${step}`);
  };

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const checkUser = async () => {
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
              console.log('[Auth] Found anonymous progress');
              try {
                const migratedData = await migrateUserProgress(session.user.id, sessionId);
                if (migratedData) {
                  console.log('[Auth] Migration successful:', migratedData);
                  onAnonymousDataChange(migratedData);
                  localStorage.removeItem('anonymous_session_id');
                  
                  if (migratedData.current_step && migratedData.current_step > 1) {
                    redirectToStep(migratedData.current_step);
                  }
                  
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
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        onUserChange(session.user);
        
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          try {
            const migratedData = await migrateUserProgress(session.user.id, sessionId);
            if (migratedData) {
              console.log('[Auth] Migrated data:', migratedData);
              onAnonymousDataChange(migratedData);
              localStorage.removeItem('anonymous_session_id');
              
              if (migratedData.current_step && migratedData.current_step > 1) {
                redirectToStep(migratedData.current_step);
              }
              
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
  }, [onUserChange, onAnonymousDataChange, toast, navigate]);

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