import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowAnonymous?: boolean;
}

interface WizardData {
  id?: string;
  user_id: string;
  business_idea?: any;
  target_audience?: any;
  audience_analysis?: any;
  current_step?: number;
  selected_hooks?: any;
  ad_format?: any;
  video_ad_preferences?: any;
  generated_ads?: any;
  version?: number;
  is_migration?: boolean;
}

const ProtectedRoute = ({ children, allowAnonymous = false }: ProtectedRouteProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [anonymousSession, setAnonymousSession] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const { toast } = useToast();

  const checkSession = async (retryCount = 0) => {
    try {
      console.log('[ProtectedRoute] Starting session check');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (allowAnonymous && !user) {
        let sessionId = localStorage.getItem('anonymous_session_id');
        
        if (!sessionId) {
          sessionId = crypto.randomUUID();
          localStorage.setItem('anonymous_session_id', sessionId);
        }
        
        console.log('[ProtectedRoute] Found anonymous session:', sessionId);
        
        const { data: anonymousData } = await supabase
          .from('anonymous_usage')
          .select('*')
          .eq('session_id', sessionId)
          .maybeSingle();
          
        console.log('[ProtectedRoute] Anonymous usage data:', anonymousData);
        
        if (!anonymousData) {
          await supabase
            .from('anonymous_usage')
            .insert([{ session_id: sessionId }]);
        }
        
        setAnonymousSession(sessionId);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(!!user);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('[ProtectedRoute] Error checking session:', error);
      const maxRetries = 3;
      
      console.log('Retry count:', retryCount);
      console.log('Max retries:', maxRetries);
      
      if (retryCount < maxRetries) {
        setTimeout(() => checkSession(retryCount + 1), 1000 * Math.pow(2, retryCount));
      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
        toast({
          title: "Authentication Error",
          description: "Failed to verify your session. Please try refreshing the page.",
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[ProtectedRoute] Auth state changed:', event);
      
      if (event === 'SIGNED_IN') {
        const currentStep = location.pathname.match(/step-(\d+)/)?.[1];
        if (currentStep) {
          const sessionId = localStorage.getItem('anonymous_session_id');
          if (sessionId) {
            try {
              const { data: anonymousData } = await supabase
                .from('anonymous_usage')
                .select('wizard_data')
                .eq('session_id', sessionId)
                .single();

              if (anonymousData?.wizard_data && typeof anonymousData.wizard_data === 'object') {
                const wizardData: WizardData = {
                  user_id: session.user.id,
                  current_step: parseInt(currentStep),
                  business_idea: anonymousData.wizard_data?.business_idea,
                  target_audience: anonymousData.wizard_data?.target_audience,
                  audience_analysis: anonymousData.wizard_data?.audience_analysis,
                  selected_hooks: anonymousData.wizard_data?.selected_hooks,
                  ad_format: anonymousData.wizard_data?.ad_format,
                  video_ad_preferences: anonymousData.wizard_data?.video_ad_preferences,
                  generated_ads: anonymousData.wizard_data?.generated_ads,
                  version: 1,
                  is_migration: true
                };
                
                await supabase
                  .from('wizard_progress')
                  .upsert(wizardData);
              }
            } catch (error) {
              console.error('[ProtectedRoute] Error migrating wizard data:', error);
            }
          }
        }
      }
      
      if (!location.pathname.includes('ad-wizard') || session?.user) {
        checkSession();
      }
    });

    checkSession();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [location.pathname]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    const currentStep = location.pathname.match(/step-(\d+)/)?.[1];
    return <Navigate to="/login" state={{ from: location.pathname, step: currentStep }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;