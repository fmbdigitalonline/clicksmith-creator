import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { migrateUserProgress } from "@/utils/migration";
import { WizardData } from "@/types/wizardProgress";

interface WizardAuthenticationProps {
  onUserChange: (user: any) => void;
  onAnonymousDataChange: (data: WizardData) => void;
}

interface MigrationQueueItem {
  userId: string;
  sessionId: string;
  retryCount: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const WizardAuthentication = ({ onUserChange, onAnonymousDataChange }: WizardAuthenticationProps) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const migrationQueue = useRef<MigrationQueueItem[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const processMigrationQueue = useCallback(async () => {
    if (isMigrating || migrationQueue.current.length === 0) return;

    setIsMigrating(true);
    const item = migrationQueue.current[0];

    try {
      console.log('[Auth] Processing migration for user:', item.userId);
      
      // Check for existing migration lock
      const { data: existingLock, error: lockError } = await supabase
        .from('migration_locks')
        .select('*')
        .eq('user_id', item.userId)
        .maybeSingle();

      if (lockError) {
        console.error('[Auth] Error checking migration lock:', lockError);
        throw lockError;
      }

      if (existingLock) {
        console.log('[Auth] Migration already in progress, will retry');
        if (item.retryCount < MAX_RETRIES) {
          migrationQueue.current[0] = {
            ...item,
            retryCount: item.retryCount + 1
          };
          setTimeout(() => setIsMigrating(false), RETRY_DELAY * (item.retryCount + 1));
          return;
        }
        throw new Error('Max retries exceeded for migration lock');
      }

      // Check for anonymous data
      const { data: anonData, error: anonError } = await supabase
        .from('anonymous_usage')
        .select('wizard_data, last_completed_step')
        .eq('session_id', item.sessionId)
        .maybeSingle();

      if (anonError) {
        console.error('[Auth] Error fetching anonymous data:', anonError);
        throw anonError;
      }

      if (!anonData) {
        console.log('[Auth] No anonymous data found for session:', item.sessionId);
        migrationQueue.current.shift();
        setIsMigrating(false);
        return;
      }

      const migratedData = await migrateUserProgress(item.userId, item.sessionId);

      if (migratedData) {
        console.log('[Auth] Migration successful:', migratedData);
        onAnonymousDataChange(migratedData);
        localStorage.removeItem('anonymous_session_id');
        migrationQueue.current.shift();

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
      } else {
        console.log('[Auth] No data to migrate');
        migrationQueue.current.shift();
      }
    } catch (error) {
      console.error('[Auth] Migration error:', error);
      if (item.retryCount < MAX_RETRIES) {
        migrationQueue.current[0] = {
          ...item,
          retryCount: item.retryCount + 1
        };
        setTimeout(() => setIsMigrating(false), RETRY_DELAY * (item.retryCount + 1));
      } else {
        console.error('[Auth] Migration failed after max retries');
        migrationQueue.current.shift();
        toast({
          title: "Error Restoring Progress",
          description: "There was an error restoring your previous work. Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setIsMigrating(false);
    }
  }, [isMigrating, navigate, location.pathname, onAnonymousDataChange, toast]);

  useEffect(() => {
    let mounted = true;
    
    const checkUser = async () => {
      try {
        console.log('[Auth] Checking user session');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!mounted) return;
        if (sessionError) throw sessionError;

        if (session?.user) {
          console.log('[Auth] User authenticated:', session.user.id);
          onUserChange(session.user);
          
          const sessionId = localStorage.getItem('anonymous_session_id');
          if (sessionId) {
            console.log('[Auth] Found anonymous session, queueing migration');
            migrationQueue.current.push({
              userId: session.user.id,
              sessionId,
              retryCount: 0
            });
            processMigrationQueue();
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
      console.group('[Auth] Auth state changed');
      console.log('Event:', event);
      console.log('User ID:', session?.user?.id);
      console.log('Timestamp:', new Date().toISOString());
      console.groupEnd();
      
      if (event === 'SIGNED_IN' && session?.user) {
        onUserChange(session.user);
        
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          migrationQueue.current.push({
            userId: session.user.id,
            sessionId,
            retryCount: 0
          });
          processMigrationQueue();
        }
      } else if (event === 'SIGNED_OUT') {
        onUserChange(null);
      }
    });

    checkUser();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [onUserChange, processMigrationQueue, toast]);

  useEffect(() => {
    if (!isMigrating && migrationQueue.current.length > 0) {
      processMigrationQueue();
    }
  }, [isMigrating, processMigrationQueue]);

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