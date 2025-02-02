import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { migrateUserProgress } from "@/utils/migration";
import { WizardData } from "@/types/wizardProgress";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { Json } from "@/integrations/supabase/types";

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
const RETRY_DELAY = 1000; // 1 second

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
      const migratedData = await migrateUserProgress(item.userId, item.sessionId);

      if (migratedData) {
        console.log('[Auth] Migration successful:', migratedData);
        onAnonymousDataChange(migratedData);
        localStorage.removeItem('anonymous_session_id');
        migrationQueue.current.shift(); // Remove processed item

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
      } else if (item.retryCount < MAX_RETRIES) {
        console.log('[Auth] Migration failed, retrying. Attempt:', item.retryCount + 1);
        migrationQueue.current[0] = {
          ...item,
          retryCount: item.retryCount + 1
        };
        setTimeout(() => {
          setIsMigrating(false);
        }, RETRY_DELAY * (item.retryCount + 1));
      } else {
        console.error('[Auth] Migration failed after max retries');
        migrationQueue.current.shift(); // Remove failed item
        toast({
          title: "Error Restoring Progress",
          description: "There was an error restoring your previous work.",
          variant: "destructive",
        });
        setIsMigrating(false);
      }
    } catch (error) {
      console.error('[Auth] Migration error:', error);
      if (item.retryCount < MAX_RETRIES) {
        migrationQueue.current[0] = {
          ...item,
          retryCount: item.retryCount + 1
        };
        setTimeout(() => {
          setIsMigrating(false);
        }, RETRY_DELAY * (item.retryCount + 1));
      } else {
        migrationQueue.current.shift();
        setIsMigrating(false);
      }
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