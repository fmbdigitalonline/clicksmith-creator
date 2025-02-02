import { useEffect, useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { refreshSessionWithRetry, withTimeout, handleAuthStateChange } from "@/utils/authUtils";

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
        
        // Add timeout to session check
        const session = await withTimeout(refreshSessionWithRetry());
        
        if (!session) {
          console.log('[ProtectedRoute] No session found, redirecting to login');
          setIsAuthenticated(false);
          navigate('/login', { 
            replace: true,
            state: { from: location.pathname }
          });
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

          if (usage && !usage.used && location.pathname !== '/ad-wizard/new') {
            console.log('[ProtectedRoute] Redirecting to new wizard');
            navigate('/ad-wizard/new', { replace: true });
            return;
          }
        }

        // Initialize free tier usage for new users
        if (session.user) {
          setIsAuthenticated(true);
          console.log('[ProtectedRoute] Checking free tier usage for user:', session.user.id);
          const { data: existingUsage } = await supabase
            .from('free_tier_usage')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (!existingUsage) {
            console.log('[ProtectedRoute] Creating new free tier usage record');
            await supabase
              .from('free_tier_usage')
              .insert([{ user_id: session.user.id, generations_used: 0 }]);
          }
        }
      } catch (error) {
        console.error("[ProtectedRoute] Auth error:", error);
        setIsAuthenticated(false);
        
        // Show specific error messages based on error type
        if (error instanceof Error) {
          if (error.message === 'Authentication operation timed out') {
            toast({
              title: "Authentication Timeout",
              description: "Please try again or refresh the page",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Authentication Error",
              description: "Please sign in again",
              variant: "destructive",
            });
          }
        }
        
        navigate('/login', { 
          replace: true,
          state: { from: location.pathname }
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthStateChange(
        event,
        session,
        (newSession) => {
          setIsAuthenticated(!!newSession);
          setIsLoading(false);
          
          if (!newSession) {
            navigate('/login', { 
              replace: true,
              state: { from: location.pathname }
            });
          }
        },
        (error) => {
          console.error('[ProtectedRoute] Auth state change error:', error);
          toast({
            title: "Authentication Error",
            description: error,
            variant: "destructive",
          });
        }
      );
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
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};