import { useEffect, useState } from "react";
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

const isWizardData = (data: any): data is WizardData => {
  return data && typeof data === 'object';
};

const isJsonObject = (value: Json): value is { [key: string]: Json } => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const convertToWizardData = (jsonData: Json): WizardData | null => {
  if (!isJsonObject(jsonData)) {
    console.error('[Auth] Invalid JSON data format:', jsonData);
    return null;
  }

  const wizardData: WizardData = {
    business_idea: jsonData.business_idea as BusinessIdea,
    target_audience: jsonData.target_audience as TargetAudience,
    audience_analysis: jsonData.audience_analysis as AudienceAnalysis,
    generated_ads: Array.isArray(jsonData.generated_ads) ? jsonData.generated_ads : [],
    current_step: typeof jsonData.current_step === 'number' ? jsonData.current_step : 1,
    version: typeof jsonData.version === 'number' ? jsonData.version : 1
  };

  return wizardData;
};

const WizardAuthentication = ({ onUserChange, onAnonymousDataChange }: WizardAuthenticationProps) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const handleMigrationSuccess = async (migratedData: WizardData) => {
    console.log('[Auth] Migration successful, updating state and URL');
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
  };

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    let isCheckingUser = false;

    const handleMigration = async (user: any, sessionId: string) => {
      try {
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
      }
    };

    const checkUser = async () => {
      if (isCheckingUser) return;
      
      isCheckingUser = true;
      console.group('[Auth] Starting user check');
      console.log('Retry count:', retryCount);
      console.log('Max retries:', maxRetries);
      console.log('Current pathname:', location.pathname);
      console.groupEnd();

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (sessionError) throw sessionError;

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
      } catch (error) {
        console.error('[Auth] Error in checkUser:', error);
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
      console.group('[Auth] Auth state changed');
      console.log('Event:', event);
      console.log('User ID:', session?.user?.id);
      console.log('Timestamp:', new Date().toISOString());
      console.groupEnd();
      
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
  }, [onUserChange, onAnonymousDataChange, toast, navigate, location]);

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