import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const AnonymousRoute = ({ children }: { children: React.ReactNode }) => {
  const [canAccess, setCanAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const location = useLocation();

  useEffect(() => {
    const checkAnonymousAccess = async () => {
      try {
        console.log('[AnonymousRoute] Starting anonymous access check...');
        
        // Check if user is already authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('[AnonymousRoute] User is authenticated, allowing access');
          setCanAccess(true);
          setIsLoading(false);
          return;
        }

        // Try to get existing anonymous session from localStorage
        const storedSession = localStorage.getItem('anonymous_session');
        if (storedSession) {
          const parsedSession = JSON.parse(storedSession);
          const { access_token, refresh_token } = parsedSession;

          console.log('[AnonymousRoute] Found stored anonymous session, attempting to restore');

          // Try to restore the session
          const { data: { session: restoredSession }, error: sessionError } = 
            await supabase.auth.setSession({
              access_token,
              refresh_token
            });

          if (sessionError || !restoredSession) {
            console.log('[AnonymousRoute] Stored session invalid, creating new one');
            localStorage.removeItem('anonymous_session');
          } else {
            console.log('[AnonymousRoute] Successfully restored anonymous session');
            setCanAccess(true);
            setIsLoading(false);
            return;
          }
        }

        console.log('[AnonymousRoute] Creating new anonymous session');

        // Create new anonymous session
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-anonymous-session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to create anonymous session');
        }

        const { session: newSession, error } = await response.json();

        if (error) {
          throw new Error(error);
        }

        // Store the session
        localStorage.setItem('anonymous_session', JSON.stringify({
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token,
        }));

        // Set the session in Supabase
        await supabase.auth.setSession({
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token,
        });

        console.log('[AnonymousRoute] New anonymous session created and stored');
        setCanAccess(true);
      } catch (error) {
        console.error('[AnonymousRoute] Error in anonymous access check:', error);
        toast({
          title: "Error",
          description: "Could not create anonymous session. Please try again.",
          variant: "destructive",
        });
        setCanAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAnonymousAccess();
  }, [toast, location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!canAccess) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};