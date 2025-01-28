import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [anonymousData, setAnonymousData] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    const checkSession = async () => {
      console.log('[ProtectedRoute] Starting session check');
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }

        // Check for anonymous session in wizard flow
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId && location.pathname.includes('ad-wizard')) {
          console.log('[ProtectedRoute] Found anonymous session:', sessionId);
          
          const { data: anonymousUsage } = await supabase
            .from('anonymous_usage')
            .select('*')
            .eq('session_id', sessionId)
            .single();

          console.log('[ProtectedRoute] Anonymous usage data:', anonymousUsage);
          
          if (anonymousUsage && !anonymousUsage.used) {
            setAnonymousData(anonymousUsage);
            setIsLoading(false);
            return;
          }
        }

        setIsAuthenticated(false);
        setIsLoading(false);
      } catch (error) {
        console.error('[ProtectedRoute] Error checking session:', error);
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    };

    checkSession();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ProtectedRoute] Auth state changed:', event);
      
      // For sign-in events, preserve the current step
      if (event === 'SIGNED_IN' && location.pathname.includes('ad-wizard')) {
        const currentStep = location.pathname.match(/step-(\d+)/)?.[1];
        if (currentStep) {
          return;
        }
      }
      
      // Only recheck session if it's not an anonymous user in the wizard
      if (!location.pathname.includes('ad-wizard') || session?.user) {
        checkSession();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [location.pathname]);

  if (isLoading) {
    return null;
  }

  // Allow anonymous access to wizard if there's valid anonymous data
  if (location.pathname.includes('ad-wizard') && anonymousData) {
    // Preserve the current step in the URL
    const currentStep = location.pathname.match(/step-(\d+)/)?.[1];
    if (currentStep && location.pathname !== `/ad-wizard/step-${currentStep}`) {
      return <Navigate to={`/ad-wizard/step-${currentStep}`} replace />;
    }
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    // Save the current step in the state when redirecting to login
    const currentStep = location.pathname.match(/step-(\d+)/)?.[1];
    return <Navigate to="/login" state={{ from: location.pathname, step: currentStep }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;