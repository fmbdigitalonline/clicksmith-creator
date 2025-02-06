import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

interface AnonymousUsage {
  used: boolean;
  wizard_data: Json;
  last_completed_step: number;
  save_count?: number;
  last_save_attempt?: string;
}

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
        
        const { data: { session } } = await supabase.auth.getSession();
        
        // If user is authenticated, always allow access
        if (session?.user) {
          console.log('[AnonymousRoute] User is already authenticated:', session.user.id);
          if (mounted) {
            setCanAccess(true);
            setIsLoading(false);
          }
          return;
        }

        let sessionId = localStorage.getItem('anonymous_session_id');
        
        // Always allow access to /ad-wizard/new and create new session if needed
        if (location.pathname === '/ad-wizard/new') {
          if (!sessionId) {
            sessionId = uuidv4();
            localStorage.setItem('anonymous_session_id', sessionId);
            console.log('[AnonymousRoute] Created new anonymous session:', sessionId);
            
            const initialWizardData: Json = {
              current_step: 1,
              business_idea: null,
              target_audience: null,
              audience_analysis: null,
              generated_ads: [],
              selected_hooks: [],
              version: 1,
              last_save_attempt: new Date().toISOString(),
              ad_format: null,
              video_ad_preferences: null
            };

            await supabase
              .from('anonymous_usage')
              .insert({
                session_id: sessionId,
                used: false,
                wizard_data: initialWizardData,
                last_save_attempt: new Date().toISOString(),
                save_count: 0
              });
          }
          
          if (mounted) {
            setCanAccess(true);
            setIsLoading(false);
          }
          return;
        }

        // For other routes, check if the session is valid
        if (sessionId) {
          const { data: usage } = await supabase
            .from('anonymous_usage')
            .select('used')
            .eq('session_id', sessionId)
            .maybeSingle();

          if (usage && !usage.used) {
            if (mounted) {
              setCanAccess(true);
              setIsLoading(false);
            }
            return;
          }
        }

        if (mounted) {
          setCanAccess(false);
          setIsLoading(false);
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