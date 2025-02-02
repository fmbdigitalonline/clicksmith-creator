import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { migrateUserProgress } from "@/utils/migration";
import { WizardData } from "@/types/wizardProgress";
import { useWizardState } from "./WizardStateProvider";

interface WizardAuthenticationProps {
  onUserChange: (user: any) => void;
  onAnonymousDataChange: (data: WizardData) => void;
}

const WizardAuthentication = ({ onUserChange, onAnonymousDataChange }: WizardAuthenticationProps) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { setIsMigrating } = useWizardState();

  const handleMigrationSuccess = async (migratedData: WizardData) => {
    console.log('[Auth] Migration successful, updating state and URL');
    setIsMigrating(true);
    onAnonymousDataChange(migratedData);
    localStorage.removeItem('anonymous_session_id');
    
    if (migratedData.current_step && migratedData.current_step > 1) {
      if (location.pathname.includes('/ad-wizard/new')) {
        console.log('[Auth] Redirecting to step:', migratedData.current_step);
        navigate(`/ad-wizard/step-${migratedData.current_step}`, { replace: true });
      }
      
      toast({
        title: "Progress Restored",
        description: "Your previous work has been saved to your account.",
      });
    }
    setIsMigrating(false);
  };

  useEffect(() => {
    let isMounted = true;
    let migrationInProgress = false;

    const handleMigration = async (user: any, sessionId: string) => {
      if (migrationInProgress) return;
      
      try {
        migrationInProgress = true;
        setIsMigrating(true);
        console.log('[Auth] Starting migration for user:', user.id);
        const migratedData = await migrateUserProgress(user.id, sessionId);
        
        if (migratedData && isMounted) {
          await handleMigrationSuccess(migratedData);
        }
      } catch (error) {
        console.error('[Auth] Migration error:', error);
        toast({
          title: "Error Restoring Progress",
          description: "There was an error restoring your previous work.",
          variant: "destructive",
        });
      } finally {
        migrationInProgress = false;
        setIsMigrating(false);
      }
    };

    const checkUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (sessionError) throw sessionError;

        if (session?.user) {
          onUserChange(session.user);
          
          const sessionId = localStorage.getItem('anonymous_session_id');
          if (sessionId) {
            await handleMigration(session.user, sessionId);
          }
        }
      } catch (error) {
        console.error('[Auth] Error in checkUser:', error);
        setAuthError('Authentication check failed. Please refresh.');
        toast({
          title: "Authentication Error",
          description: "Failed to check authentication status. Please refresh the page.",
          variant: "destructive",
        });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        onUserChange(session.user);
        
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          await handleMigration(session.user, sessionId);
        }
      } else if (event === 'SIGNED_OUT') {
        onUserChange(null);
      }
    });

    checkUser();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [onUserChange, onAnonymousDataChange, toast, navigate, location, setIsMigrating]);

  if (authError) {
    return (
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
        {authError}
      </div>
    );
  }

  return null;
};

export default WizardAuthentication;