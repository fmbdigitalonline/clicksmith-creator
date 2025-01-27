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
    console.log('[Auth] Redirecting to step:', step, {
      location: location.pathname,
      state: location.state,
      isNewRegistration: location.state?.from === '/login'
    });
    
    // For new registrations, ensure they continue from their last step
    const isNewRegistration = location.state?.from === '/login';
    const targetStep = step || 1; // Default to step 1 if no step is provided
    
    if (!targetStep || targetStep < 1) {
      console.error('[Auth] Invalid step value:', { targetStep, step });
      return;
    }

    console.log('[Auth] Navigating to step:', {
      targetStep,
      isNewRegistration,
      currentPath: location.pathname
    });
    navigate(`/ad-wizard/new`, { state: { step: targetStep } });
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
        console.log('[Auth] Starting user check', {
          retryCount,
          maxRetries,
          pathname: location.pathname
        });
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (sessionError) {
          console.error('[Auth] Session error:', {
            error: sessionError,
            retryCount
          });
          throw sessionError;
        }

        if (session?.user) {
          console.log('[Auth] Found authenticated user:', {
            userId: session.user.id,
            email: session.user.email,
            lastSignIn: session.user.last_sign_in_at
          });
          onUserChange(session.user);
          
          const { data: existing } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

          console.log('[Auth] Existing wizard progress:', {
            found: !!existing,
            currentStep: existing?.current_step,
            userId: session.user.id
          });

          const sessionId = localStorage.getItem('anonymous_session_id');
          if (sessionId) {
            console.log('[Auth] Found anonymous session:', {
              sessionId,
              userId: session.user.id
            });
            
            const { data: anonymousData } = await supabase
              .from('anonymous_usage')
              .select('wizard_data')
              .eq('session_id', sessionId)
              .maybeSingle();

            console.log('[Auth] Anonymous data found:', {
              hasData: !!anonymousData?.wizard_data,
              sessionId
            });

            if (anonymousData?.wizard_data) {
              console.log('[Auth] Starting migration process', {
                userId: session.user.id,
                sessionId,
                currentStep: anonymousData.wizard_data.current_step
              });
              try {
                const migratedData = await migrateUserProgress(session.user.id, sessionId);
                if (migratedData) {
                  console.log('[Auth] Migration successful:', {
                    userId: session.user.id,
                    currentStep: migratedData.current_step,
                    hasBusinessIdea: !!migratedData.business_idea
                  });
                  onAnonymousDataChange(migratedData);
                  localStorage.removeItem('anonymous_session_id');
                  
                  // Use the current_step from migrated data
                  const step = migratedData.current_step || 1;
                  console.log('[Auth] Redirecting to step after migration:', {
                    step,
                    userId: session.user.id,
                    isNewRegistration: location.state?.from === '/login'
                  });
                  redirectToStep(step);
                  
                  toast({
                    title: "Progress Restored",
                    description: "Your previous work has been saved to your account.",
                  });
                }
              } catch (error) {
                console.error('[Auth] Migration error:', {
                  error,
                  userId: session.user.id,
                  sessionId
                });
                toast({
                  title: "Error Restoring Progress",
                  description: "There was an error restoring your previous work. You may need to start over.",
                  variant: "destructive",
                });
              }
            }
          } else if (existing) {
            console.log('[Auth] Found existing progress for user:', {
              userId: session.user.id,
              currentStep: existing.current_step
            });
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
        console.error('[Auth] Error:', {
          error,
          retryCount,
          maxRetries
        });
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
      console.log('[Auth] Auth state changed:', {
        event,
        userId: session?.user?.id,
        timestamp: new Date().toISOString()
      });
      
      if (event === 'SIGNED_IN' && session?.user) {
        onUserChange(session.user);
        
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          try {
            console.log('[Auth] Starting migration after sign in:', {
              userId: session.user.id,
              sessionId
            });
            const migratedData = await migrateUserProgress(session.user.id, sessionId);
            if (migratedData) {
              console.log('[Auth] Migration successful after sign in:', {
                userId: session.user.id,
                currentStep: migratedData.current_step,
                hasBusinessIdea: !!migratedData.business_idea
              });
              onAnonymousDataChange(migratedData);
              localStorage.removeItem('anonymous_session_id');
              
              // Use the current_step from migrated data
              const step = migratedData.current_step || 1;
              console.log('[Auth] Redirecting to step after sign in:', {
                step,
                userId: session.user.id
              });
              redirectToStep(step);
              
              toast({
                title: "Progress Migrated",
                description: "Your previous work has been saved to your account.",
              });
            }
          } catch (error) {
            console.error('[Auth] Migration error:', {
              error,
              userId: session.user.id,
              sessionId
            });
            toast({
              title: "Migration Error",
              description: "There was an error migrating your progress. You may need to start over.",
              variant: "destructive",
            });
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[Auth] User signed out');
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