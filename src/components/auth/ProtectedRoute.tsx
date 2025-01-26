import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/providers/SessionProvider";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { migrationStatus } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Skip check if already migrated
        if (location.state?.migrated) return;

        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error("[ProtectedRoute] Auth error:", error);
          toast({
            title: "Authentication Error",
            description: "Please sign in again",
            variant: "destructive",
          });
          navigate('/login', { replace: true });
          return;
        }

        const sessionId = localStorage.getItem('anonymous_session_id');

        // Handle migration if needed
        if (user && sessionId && migrationStatus === 'idle') {
          console.log('[ProtectedRoute] Migration needed, redirecting...');
          navigate('/migration-handoff', {
            state: {
              from: location.pathname,
              sessionId
            }
          });
          return;
        }

        // Check for anonymous session
        if (!user && !sessionId) {
          console.log('[ProtectedRoute] No session found, creating anonymous session');
          const newSessionId = crypto.randomUUID();
          localStorage.setItem('anonymous_session_id', newSessionId);
          
          const { error: usageError } = await supabase
            .from('anonymous_usage')
            .insert([{ session_id: newSessionId }]);

          if (usageError) {
            console.error('[ProtectedRoute] Error creating anonymous session:', usageError);
            toast({
              title: "Error",
              description: "Failed to initialize session",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('[ProtectedRoute] Unexpected error:', error);
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      }
    };

    checkSession();
  }, [location, migrationStatus, navigate, toast]);

  // Show loading state while checking session
  if (migrationStatus === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return <>{children}</>;
};