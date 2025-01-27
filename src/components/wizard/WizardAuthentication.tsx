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

  return {
    business_idea: jsonData.business_idea as BusinessIdea,
    target_audience: jsonData.target_audience as TargetAudience,
    audience_analysis: jsonData.audience_analysis as AudienceAnalysis,
    generated_ads: Array.isArray(jsonData.generated_ads) ? jsonData.generated_ads : [],
    current_step: typeof jsonData.current_step === 'number' ? jsonData.current_step : 1,
    version: typeof jsonData.version === 'number' ? jsonData.version : 1
  };
};

const WizardAuthentication = ({ onUserChange, onAnonymousDataChange }: WizardAuthenticationProps) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectToStep = (step: number) => {
    console.group('[Auth] Redirecting to step');
    console.log('Step:', step);
    console.log('Current location:', location.pathname);
    console.log('Location state:', location.state);
    console.log('Is new registration:', location.state?.from === '/login');
    console.groupEnd();
    
    const isNewRegistration = location.state?.from === '/login';
    const targetStep = step || 1;
    
    if (!targetStep || targetStep < 1) {
      console.error('[Auth] Invalid step value:', { targetStep, step });
      return;
    }

    const currentPathMatch = location.pathname.match(/step-(\d+)/);
    const currentStep = currentPathMatch ? parseInt(currentPathMatch[1]) : 1;
    
    if (currentStep !== targetStep) {
      console.log('[Auth] Navigating to step:', {
        targetStep,
        isNewRegistration,
        currentPath: location.pathname
      });
      navigate(`/ad-wizard/step-${targetStep}`, { replace: true });
    }
  };

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    let isCheckingUser = false;

    const checkUser = async () => {
      if (isCheckingUser) {
        console.log('[Auth] User check already in progress');
        return;
      }
      
      isCheckingUser = true;
      console.group('[Auth] Starting user check');
      console.log('Retry count:', retryCount);
      console.log('Max retries:', maxRetries);
      console.log('Current pathname:', location.pathname);
      console.groupEnd();

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) {
          console.log('[Auth] Component unmounted, stopping check');
          return;
        }

        if (sessionError) {
          console.group('[Auth] Session error');
          console.error('Error:', sessionError);
          console.log('Retry count:', retryCount);
          console.groupEnd();
          throw sessionError;
        }

        if (session?.user) {
          console.group('[Auth] Found authenticated user');
          console.log('User ID:', session.user.id);
          console.log('Email:', session.user.email);
          console.log('Last sign in:', session.user.last_sign_in_at);
          console.groupEnd();
          
          onUserChange(session.user);

          // Check for anonymous session data to migrate
          const sessionId = localStorage.getItem('anonymous_session_id');
          if (sessionId) {
            const { data: anonymousData } = await supabase
              .from('anonymous_usage')
              .select('wizard_data')
              .eq('session_id', sessionId)
              .maybeSingle();

            if (anonymousData?.wizard_data) {
              try {
                console.log('[Auth] Starting migration for session:', sessionId);
                const migratedData = await migrateUserProgress(session.user.id, sessionId);
                if (migratedData) {
                  const convertedData = convertToWizardData(migratedData);
                  if (convertedData) {
                    onAnonymousDataChange(convertedData);
                    localStorage.removeItem('anonymous_session_id');
                    
                    // Get the current step from the URL if it exists
                    const currentPathMatch = location.pathname.match(/step-(\d+)/);
                    const currentUrlStep = currentPathMatch ? parseInt(currentPathMatch[1]) : null;
                    
                    // Use the highest step between migrated data and URL
                    const targetStep = Math.max(
                      migratedData.current_step || 1,
                      currentUrlStep || 1
                    );
                    
                    // Only redirect if we're not already on the correct step
                    if (targetStep > 1 && (!currentUrlStep || currentUrlStep !== targetStep)) {
                      console.log('[Auth] Redirecting to step:', targetStep);
                      redirectToStep(targetStep);
                    }

                    toast({
                      title: "Progress Restored",
                      description: "Your previous work has been saved to your account.",
                    });
                  }
                }
              } catch (error) {
                console.error('[Auth] Migration error:', error);
                toast({
                  title: "Migration Error",
                  description: "There was an error restoring your previous work. You may need to start over.",
                  variant: "destructive",
                });
              }
            }
          }
        }

        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          const { data: anonymousData } = await supabase
            .from('anonymous_usage')
            .select('wizard_data')
            .eq('session_id', sessionId)
            .maybeSingle();

          if (anonymousData?.wizard_data) {
            const wizardData = convertToWizardData(anonymousData.wizard_data);
            if (wizardData) {
              onAnonymousDataChange(wizardData);
            }
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
          try {
            console.group('[Auth] Starting migration after sign in');
            console.log('User ID:', session.user.id);
            console.log('Session ID:', sessionId);
            console.groupEnd();
            
            const migratedData = await migrateUserProgress(session.user.id, sessionId);
            if (migratedData) {
              console.group('[Auth] Migration successful after sign in');
              console.log('User ID:', session.user.id);
              console.log('Current step:', migratedData.current_step);
              console.log('Has business idea:', !!migratedData.business_idea);
              console.groupEnd();
              
              onAnonymousDataChange(migratedData);
              localStorage.removeItem('anonymous_session_id');
              
              const step = migratedData.current_step || 1;
              console.log('[Auth] Redirecting to step after sign in:', step);
              redirectToStep(step);
              
              toast({
                title: "Progress Migrated",
                description: "Your previous work has been saved to your account.",
              });
            }
          } catch (error) {
            console.error('[Auth] Migration error after sign in:', error);
            toast({
              title: "Migration Error",
              description: "There was an error migrating your progress. You may need to start over.",
              variant: "destructive",
            });
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[Auth] User signed out');
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