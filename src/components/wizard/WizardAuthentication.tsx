import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WizardAuthenticationProps {
  onUserChange: (user: any) => void;
  onAnonymousDataChange: (data: any) => void;
}

const WizardAuthentication = ({
  onUserChange,
  onAnonymousDataChange,
}: WizardAuthenticationProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const handleMigration = async (user: any, sessionId: string) => {
    console.log('[Auth] Starting migration for user:', user.id);
    
    try {
      const { data: migratedData, error } = await supabase.rpc('atomic_migration', {
        p_user_id: user.id,
        p_session_id: sessionId
      });

      if (error) throw error;

      console.log('[Auth] Migration successful:', migratedData);
      
      // Clear anonymous session
      localStorage.removeItem('anonymous_session_id');
      
      if (migratedData?.current_step && migratedData.current_step > 1) {
        if (location.pathname.includes('/ad-wizard/new')) {
          console.log('[Auth] Redirecting to step:', migratedData.current_step);
          navigate(`/ad-wizard/step-${migratedData.current_step}`, { replace: true });
        }
      }

      toast({
        title: "Progress Restored",
        description: "Your previous progress has been restored.",
      });
    } catch (error) {
      console.error('[Auth] Migration error:', error);
      toast({
        title: "Error",
        description: "Failed to restore your previous progress.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const setupAnonymousSession = async () => {
      let sessionId = localStorage.getItem('anonymous_session_id');
      
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem('anonymous_session_id', sessionId);
      }

      const { data: anonymousData } = await supabase
        .from('anonymous_usage')
        .select('wizard_data')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (anonymousData) {
        onAnonymousDataChange(anonymousData.wizard_data);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Auth state changed:', event);
        
        if (event === 'SIGNED_OUT') {
          onUserChange(null);
          setupAnonymousSession();
        } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          if (session?.user) {
            onUserChange(session.user);
            
            // Changed from .single() to .maybeSingle() to handle no rows gracefully
            const { data: existingLock } = await supabase
              .from('migration_locks')
              .select('*')
              .eq('user_id', session.user.id)
              .maybeSingle();

            const sessionId = localStorage.getItem('anonymous_session_id');
            if (sessionId && !existingLock) {
              await handleMigration(session.user, sessionId);
            }
          }
        }
      }
    );

    setupAnonymousSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [onUserChange, onAnonymousDataChange, navigate, toast, location.pathname]);

  return null;
};

export default WizardAuthentication;