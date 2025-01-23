import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import logger from "@/utils/logger";

interface WizardAuthenticationProps {
  onUserChange: (user: any) => void;
  onAnonymousDataChange: (data: any) => void;
}

const WizardAuthentication = ({
  onUserChange,
  onAnonymousDataChange,
}: WizardAuthenticationProps) => {
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          if (error.name !== "AuthSessionMissingError") {
            logger.error("[WizardAuthentication] Session error:", { error });
          }
          return;
        }

        if (user) {
          onUserChange(user);
        } else {
          const sessionId = localStorage.getItem('anonymous_session_id');
          if (sessionId) {
            const { data: anonymousData } = await supabase
              .from('anonymous_usage')
              .select('wizard_data')
              .eq('session_id', sessionId)
              .maybeSingle();

            if (anonymousData?.wizard_data) {
              onAnonymousDataChange(anonymousData.wizard_data);
            }
          }
        }
      } catch (error) {
        logger.error("[WizardAuthentication] Error checking user:", { error });
      }
    };

    const authListener = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        onUserChange(session.user);
      } else if (event === 'SIGNED_OUT') {
        onUserChange(null);
      }
    });

    checkUser();
    return () => {
      authListener.data.subscription.unsubscribe();
    };
  }, [onUserChange, onAnonymousDataChange]);

  return null;
};

export default WizardAuthentication;