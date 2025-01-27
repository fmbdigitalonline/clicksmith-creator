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
    const checkAnonymousAccess = async () => {
      try {
        console.log('[AnonymousRoute] Starting anonymous access check...');
        
        // Check if user is already authenticated
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('[AnonymousRoute] User is already authenticated:', session.user.id);
          setCanAccess(true);
          setIsLoading(false);
          return;
        }

        // Get or create session ID from localStorage
        let sessionId = localStorage.getItem('anonymous_session_id');
        if (!sessionId) {
          sessionId = uuidv4();
          localStorage.setItem('anonymous_session_id', sessionId);
          console.log('[AnonymousRoute] Created new anonymous session:', sessionId);
          
          // Initialize anonymous usage record for new sessions
          const { error: initError } = await supabase
            .from('anonymous_usage')
            .insert({
              session_id: sessionId,
              used: false,
              last_completed_step: 1
            });

          if (initError) {
            console.error('[AnonymousRoute] Error initializing anonymous usage:', initError);
            throw initError;
          }
        } else {
          console.log('[AnonymousRoute] Found existing anonymous session:', sessionId);
        }

        // Check if this session has already been used
        const { data: usage, error } = await supabase
          .from('anonymous_usage')
          .select('used, last_completed_step')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (error) {
          console.error('[AnonymousRoute] Error checking usage:', error);
          throw error;
        }

        // Allow access if no usage record exists or if they haven't completed step 3
        if (!usage || usage.last_completed_step <= 3) {
          console.log('[AnonymousRoute] Allowing access, step:', usage?.last_completed_step || 1);
          setCanAccess(true);
        } else {
          console.log('[AnonymousRoute] Access denied, completed step:', usage.last_completed_step);
          toast({
            title: "Registration Required",
            description: "Please sign up to continue and see your generated ads.",
            variant: "default",
          });
          setCanAccess(false);
        }
      } catch (error) {
        console.error('[AnonymousRoute] Error in anonymous access check:', error);
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