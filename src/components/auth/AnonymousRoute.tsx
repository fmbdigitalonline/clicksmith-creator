import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

const AnonymousRoute = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const initializeAnonymousSession = async () => {
      console.log('[AnonymousRoute] Starting anonymous access check...');
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          console.log('[AnonymousRoute] User is already authenticated:', user.id);
          return;
        }

        // Check for existing anonymous session
        let existingSessionId = localStorage.getItem('anonymous_session_id');
        
        if (!existingSessionId) {
          existingSessionId = uuidv4();
          localStorage.setItem('anonymous_session_id', existingSessionId);
          console.log('[AnonymousRoute] Created new anonymous session:', existingSessionId);
          
          // Initialize anonymous usage record
          await supabase.from('anonymous_usage').insert({
            session_id: existingSessionId,
            used: false,
            wizard_data: {},
            last_completed_step: 1
          });
        }

        setSessionId(existingSessionId);
      } catch (error) {
        console.error('[AnonymousRoute] Error in anonymous session check:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAnonymousSession();
  }, []);

  if (isLoading) {
    return null;
  }

  // Only redirect if we're not in the wizard flow
  if (!sessionId && !location.pathname.includes('ad-wizard')) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

export default AnonymousRoute;