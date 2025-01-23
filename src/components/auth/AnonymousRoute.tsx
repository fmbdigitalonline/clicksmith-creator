import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/hooks/use-toast";

export const AnonymousRoute = ({ children }: { children: React.ReactNode }) => {
  const [canAccess, setCanAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const location = useLocation();

  useEffect(() => {
    const initializeAnonymousSession = async () => {
      try {
        console.log('[AnonymousRoute] Starting anonymous session initialization...');
        
        // Check if user is already authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('[AnonymousRoute] User is authenticated, allowing access');
          setCanAccess(true);
          setIsLoading(false);
          return;
        }

        // Get or create session ID
        let sessionId = localStorage.getItem('anonymous_session_id');
        if (!sessionId) {
          sessionId = uuidv4();
          localStorage.setItem('anonymous_session_id', sessionId);
          console.log('[AnonymousRoute] Created new anonymous session:', sessionId);
        }

        // Check if session exists in database and create if it doesn't
        const { data: existingSession, error: checkError } = await supabase
          .from('anonymous_usage')
          .select('*')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('[AnonymousRoute] Error checking session:', checkError);
          throw checkError;
        }

        // If no session exists, create one with initial state
        if (!existingSession) {
          console.log('[AnonymousRoute] Creating new session record');
          const { error: insertError } = await supabase
            .from('anonymous_usage')
            .insert({
              session_id: sessionId,
              used: false,
              completed: false,
              last_completed_step: 1,
              wizard_data: {
                business_idea: null,
                target_audience: null,
                generated_ads: []
              }
            });

          if (insertError) {
            console.error('[AnonymousRoute] Error creating session:', insertError);
            throw insertError;
          }
        } else {
          console.log('[AnonymousRoute] Found existing session:', existingSession);
          
          // Check if user has completed step 3 and needs to register
          if (existingSession.last_completed_step > 3) {
            console.log('[AnonymousRoute] User has completed step 3, redirecting to login');
            toast({
              title: "Registration Required",
              description: "Please sign up to continue and see your generated ads.",
              variant: "default",
            });
            setCanAccess(false);
            setIsLoading(false);
            return;
          }
        }

        // Allow access for steps 1-3 or new sessions
        setCanAccess(true);

      } catch (error) {
        console.error('[AnonymousRoute] Error in session initialization:', error);
        toast({
          title: "Session Error",
          description: "There was an error initializing your session. Please try refreshing the page.",
          variant: "destructive",
        });
        setCanAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAnonymousSession();
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