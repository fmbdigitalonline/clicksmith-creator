import { useEffect, useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

          // Only allow anonymous access to /ad-wizard/new
          if (location.pathname === '/ad-wizard/new') {
            setIsAuthenticated(true);
            setIsLoading(false);
            return;
          }

          // If not on /ad-wizard/new and has unused anonymous session, redirect
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

            if (user) {
              setIsAuthenticated(true);
              console.log('[ProtectedRoute] User authenticated:', user.id);
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
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, toast, location.pathname]);

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