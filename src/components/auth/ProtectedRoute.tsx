import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('[ProtectedRoute] Starting session check');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("[ProtectedRoute] Session error:", sessionError);
          setIsAuthenticated(false);
          navigate('/login', { replace: true });
          return;
        }

        // Check for anonymous session
        const anonymousSessionId = localStorage.getItem('anonymous_session_id');
        if (!session && anonymousSessionId) {
          console.log('[ProtectedRoute] Found anonymous session:', anonymousSessionId);
          const { data: usage } = await supabase
            .from('anonymous_usage')
            .select('used, wizard_data')
            .eq('session_id', anonymousSessionId)
            .maybeSingle();

          console.log('[ProtectedRoute] Anonymous usage data:', usage);

          if (usage && !usage.used) {
            console.log('[ProtectedRoute] Redirecting to new wizard');
            navigate('/ad-wizard/new', { replace: true });
            return;
          }
        }

        if (!session) {
          console.log('[ProtectedRoute] No session found, redirecting to login');
          setIsAuthenticated(false);
          navigate('/login', { replace: true });
          return;
        }

        // Only attempt to refresh if we have a valid session
        if (session) {
          try {
            const { data: { user }, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              if (refreshError.message.includes('refresh_token_not_found')) {
                console.error("[ProtectedRoute] Invalid refresh token, redirecting to login");
                await supabase.auth.signOut();
                setIsAuthenticated(false);
                navigate('/login', { replace: true });
                toast({
                  title: "Session Expired",
                  description: "Please sign in again",
                  variant: "destructive",
                });
                return;
              }
              throw refreshError;
            }

            // Initialize free tier usage for new users
            if (user) {
              console.log('[ProtectedRoute] Checking free tier usage for user:', user.id);
              const { data: existingUsage } = await supabase
                .from('free_tier_usage')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

              console.log('[ProtectedRoute] Found existing free tier usage record:', existingUsage);

              if (!existingUsage) {
                console.log('[ProtectedRoute] Creating new free tier usage record');
                await supabase
                  .from('free_tier_usage')
                  .insert([{ user_id: user.id, generations_used: 0 }]);
              }

              // Check for anonymous session data to migrate
              const anonymousSessionId = localStorage.getItem('anonymous_session_id');
              if (anonymousSessionId) {
                console.log('[ProtectedRoute] Starting migration for session:', anonymousSessionId);
                try {
                  const { data: migratedData, error: migrationError } = await supabase
                    .rpc('atomic_migration', { 
                      p_user_id: user.id, 
                      p_session_id: anonymousSessionId 
                    });

                  if (migrationError) {
                    console.error("[ProtectedRoute] Migration error:", migrationError);
                    throw migrationError;
                  }

                  if (migratedData) {
                    console.log("[ProtectedRoute] Successfully migrated data:", migratedData);
                    localStorage.removeItem('anonymous_session_id');
                    
                    // Redirect to the appropriate step
                    if (migratedData.current_step && migratedData.current_step > 1) {
                      console.log('[ProtectedRoute] Redirecting to step:', migratedData.current_step);
                      navigate(`/ad-wizard/step-${migratedData.current_step}`, { replace: true });
                    }

                    toast({
                      title: "Progress Restored",
                      description: "Your previous work has been saved to your account.",
                    });
                  }
                } catch (error) {
                  console.error("[ProtectedRoute] Error during migration:", error);
                  toast({
                    title: "Migration Error",
                    description: "There was an error restoring your previous work. You may need to start over.",
                    variant: "destructive",
                  });
                }
              }
              
              setIsAuthenticated(true);
            }
          } catch (error) {
            console.error("[ProtectedRoute] Token refresh error:", error);
            setIsAuthenticated(false);
            navigate('/login', { replace: true });
            toast({
              title: "Authentication Error",
              description: "Please sign in again",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error("[ProtectedRoute] Auth error:", error);
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    // Check initial session
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[ProtectedRoute] Auth state changed:", event);
      
      const handleAuthEvent = (event: AuthEvent) => {
        switch (event) {
          case 'SIGNED_OUT':
            setIsAuthenticated(false);
            navigate('/login', { replace: true });
            toast({
              title: "Signed Out",
              description: "You have been signed out",
            });
            break;
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            setIsAuthenticated(true);
            break;
          case 'USER_UPDATED':
            setIsAuthenticated(!!session);
            break;
        }
      };

      handleAuthEvent(event as AuthEvent);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};