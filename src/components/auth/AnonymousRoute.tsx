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
    let mounted = true;

    const checkAnonymousAccess = async () => {
      try {
        console.log('[AnonymousRoute] Starting anonymous access check...');
        
        // Check if user is already authenticated
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AnonymousRoute] Session check error:', error);
          if (mounted) {
            setCanAccess(false);
            setIsLoading(false);
          }
          return;
        }
        
        if (session?.user) {
          console.log('[AnonymousRoute] User is already authenticated:', session.user.id);
          if (mounted) {
            setCanAccess(true);
            setIsLoading(false);
          }
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
              last_completed_step: 1,
              wizard_data: {
                current_step: 1,
                business_idea: null,
                target_audience: null,
                audience_analysis: null,
                generated_ads: []
              }
            });

          if (initError) {
            console.error('[AnonymousRoute] Error initializing anonymous usage:', initError);
            if (mounted) {
              setCanAccess(false);
              setIsLoading(false);
            }
            return;
          }
        } else {
          console.log('[AnonymousRoute] Found existing anonymous session:', sessionId);
        }

        // Check if this session has been used
        const { data: usage, error: usageError } = await supabase
          .from('anonymous_usage')
          .select('used, last_completed_step, wizard_data')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (usageError) {
          console.error('[AnonymousRoute] Error checking usage:', usageError);
          if (mounted) {
            setCanAccess(false);
            setIsLoading(false);
          }
          return;
        }

        if (!usage || usage.last_completed_step <= 3) {
          console.log('[AnonymousRoute] Allowing access, step:', usage?.last_completed_step || 1);
          if (mounted) {
            setCanAccess(true);
            setIsLoading(false);
          }
        } else {
          console.log('[AnonymousRoute] Access denied, completed step:', usage.last_completed_step);
          toast({
            title: "Registration Required",
            description: "Please sign up to continue and see your generated ads.",
            variant: "default",
          });
          if (mounted) {
            setCanAccess(false);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('[AnonymousRoute] Error in anonymous access check:', error);
        if (mounted) {
          setCanAccess(false);
          setIsLoading(false);
        }
      }
    };

    checkAnonymousAccess();

    return () => {
      mounted = false;
    };
  }, [toast, location.pathname]);

  if (isLoading) {
    console.log('[AnonymousRoute] Loading state...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!canAccess) {
    console.log('[AnonymousRoute] Access denied, redirecting to login');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  console.log('[AnonymousRoute] Access granted, rendering children');
  return <>{children}</>;
};