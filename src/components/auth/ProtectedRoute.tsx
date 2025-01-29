import { useEffect, useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
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
                    
                    // Get the current step from the URL if it exists
                    const currentPathMatch = location.pathname.match(/step-(\d+)/);
                    const currentUrlStep = currentPathMatch ? parseInt(currentPathMatch[1]) : null;
                    
                    // Use the highest step between migrated data and URL
                    const targetStep = Math.max(
                      migratedData.current_step || 1,
                      currentUrlStep || 1
                    );
                    
                    // Only redirect if we're not already on the correct step
                    if (targetStep > 1 && (!currentUrlStep || currentUrlStep !== targetStep)) {
                      console.log('[ProtectedRoute] Redirecting to step:', targetStep);
                      navigate(`/ad-wizard/step-${targetStep}`, { replace: true });
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

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[ProtectedRoute] Auth state changed:", event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        setIsAuthenticated(true);
        
        // Check for existing progress when user signs in
        const { data: existingProgress } = await supabase
          .from('wizard_progress')
          .select('current_step')
          .eq('user_id', session.user.id)
          .maybeSingle();
          
        if (existingProgress?.current_step > 1) {
          navigate(`/ad-wizard/step-${existingProgress.current_step}`, { replace: true });
        }
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, toast, location]);

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