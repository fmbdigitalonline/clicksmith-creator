import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { migrateUserProgress } from "@/utils/migration";
import { WizardData } from "@/types/wizardProgress";
import { useSession } from "@/providers/SessionProvider";

const isWizardData = (data: any): data is WizardData => {
  return typeof data === 'object' && data !== null;
};

const WizardAuthentication = ({ 
  onUserChange, 
  onAnonymousDataChange 
}: { 
  onUserChange: (user: any) => void;
  onAnonymousDataChange: (data: WizardData) => void;
}) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { migrationStatus, setMigrationStatus } = useSession();

  const handleMigration = async (user: any, sessionId: string) => {
    setIsMigrating(true);
    try {
      const migratedData = await migrateUserProgress(user.id, sessionId);
      if (!migratedData || !isWizardData(migratedData)) {
        throw new Error('Migration failed - no data returned or invalid data');
      }
      
      const validatedStep = validateStepRequirements(migratedData);
      
      const { error } = await supabase
        .from('wizard_progress')
        .update({ current_step: validatedStep })
        .eq('user_id', user.id);

      if (!error) {
        onAnonymousDataChange({ ...migratedData, current_step: validatedStep });
        navigate('/ad-wizard/new', {
          state: { 
            migrated: true,
            step: validatedStep 
          }
        });
        localStorage.removeItem('anonymous_session_id');
      }
    } catch (error) {
      console.error('[Migration] Failed:', error);
      toast({
        title: "Migration Issue",
        description: "Couldn't fully restore your progress. Please verify your steps.",
        variant: "destructive"
      });
    } finally {
      setIsMigrating(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    let isCheckingUser = false;

    const checkUser = async () => {
      if (isCheckingUser || isMigrating) return;
      isCheckingUser = true;

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (sessionError) throw sessionError;

        if (session?.user) {
          onUserChange(session.user);
          const sessionId = localStorage.getItem('anonymous_session_id') 
                         || location.state?.preservedSession;

          if (sessionId) {
            console.log('[Auth] Migration candidate found');
            await handleMigration(session.user, sessionId);
          } else {
            const { data: existing } = await supabase
              .from('wizard_progress')
              .select('*')
              .eq('user_id', session.user.id)
              .single();

            if (existing?.current_step) {
              navigate('/ad-wizard/new', {
                state: { step: existing.current_step }
              });
            }
          }
        }

        // Handle preserved anonymous sessions
        const preservedSession = location.state?.preservedSession;
        if (preservedSession) {
          localStorage.setItem('anonymous_session_id', preservedSession);
          const { data: anonymousData } = await supabase
            .from('anonymous_usage')
            .select('wizard_data')
            .eq('session_id', preservedSession)
            .single();

          if (anonymousData?.wizard_data && isWizardData(anonymousData.wizard_data)) {
            onAnonymousDataChange(anonymousData.wizard_data);
          }
        }

      } catch (error) {
        console.error('[Auth] Error:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(checkUser, 1000 * retryCount);
        } else {
          setAuthError('Authentication check failed. Please refresh.');
          toast({
            title: "Authentication Error",
            description: "Failed to check authentication status. Please refresh the page.",
            variant: "destructive",
          });
        }
      } finally {
        isCheckingUser = false;
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const sessionId = localStorage.getItem('anonymous_session_id') 
                        || sessionStorage.getItem('pending_migration');
        
        if (sessionId) {
          console.log('[Auth] Handling post-auth migration');
          await handleMigration(session.user, sessionId);
          sessionStorage.removeItem('pending_migration');
        }
      }
    });

    checkUser();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [onUserChange, onAnonymousDataChange, toast, navigate, location.state, isMigrating]);

  const validateStepRequirements = (data: WizardData): number => {
    const requirements = {
      step1: !!data.business_idea?.toString().trim(),
      step2: !!data.target_audience?.toString().trim(),
      step3: !!data.audience_analysis
    };

    return Math.max(
      requirements.step3 ? 3 : 
      requirements.step2 ? 2 : 
      requirements.step1 ? 1 : 1
    );
  };

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