import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logger from "@/utils/logger";

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      try {
        logger.info("Checking session", { component: "ProtectedRoute" });
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          logger.error("Session error", { 
            component: "ProtectedRoute", 
            error: sessionError 
          });
          setIsAuthenticated(false);
          navigate('/login', { replace: true });
          return;
        }

        // Check for anonymous session
        const anonymousSessionId = localStorage.getItem('anonymous_session_id');
        if (!session && anonymousSessionId) {
          logger.info("Checking anonymous session", { 
            component: "ProtectedRoute",
            details: { anonymousSessionId }
          });
          const { data: usage } = await supabase
            .from('anonymous_usage')
            .select('used')
            .eq('session_id', anonymousSessionId)
            .single();

          if (usage && !usage.used) {
            logger.info("Valid anonymous session found", { component: "ProtectedRoute" });
            navigate('/ad-wizard/new', { replace: true });
            return;
          }
        }

        if (!session) {
          logger.info("No valid session found", { component: "ProtectedRoute" });
          setIsAuthenticated(false);
          navigate('/login', { replace: true });
          return;
        }

        if (session) {
          try {
            const { data: { user }, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              if (refreshError.message.includes('refresh_token_not_found')) {
                console.error("Invalid refresh token, redirecting to login");
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
              const { data: existingUsage } = await supabase
                .from('free_tier_usage')
                .select('*')
                .eq('user_id', user.id)
                .single();

              if (!existingUsage) {
                await supabase
                  .from('free_tier_usage')
                  .insert([{ user_id: user.id, generations_used: 0 }]);
              }
              
              setIsAuthenticated(true);
            }
          } catch (error) {
            console.error("Token refresh error:", error);
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
        logger.error("Authentication check failed", { 
          component: "ProtectedRoute", 
          error 
        });
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
      logger.info("Auth state changed", { 
        component: "ProtectedRoute",
        details: { event, userId: session?.user?.id }
      });
      
      const handleAuthEvent = (event: AuthEvent) => {
        switch (event) {
          case 'SIGNED_OUT':
            logger.info("User signed out", { component: "ProtectedRoute" });
            setIsAuthenticated(false);
            navigate('/login', { replace: true });
            toast({
              title: "Signed Out",
              description: "You have been signed out",
            });
            break;
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            logger.info("User authenticated", { 
              component: "ProtectedRoute",
              details: { event }
            });
            setIsAuthenticated(true);
            break;
          case 'USER_UPDATED':
            logger.info("User profile updated", { component: "ProtectedRoute" });
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
