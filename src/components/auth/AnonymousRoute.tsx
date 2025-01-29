import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/hooks/auth/useAuthStore";

export const AnonymousRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { toast } = useToast();
  const location = useLocation();

  useEffect(() => {
    const initializeAnonymousSession = async () => {
      const sessionId = localStorage.getItem('anonymous_session_id') || uuidv4();
      
      if (!localStorage.getItem('anonymous_session_id')) {
        localStorage.setItem('anonymous_session_id', sessionId);
        
        const { error } = await supabase
          .from('anonymous_usage')
          .insert({
            session_id: sessionId,
            used: false,
            wizard_data: {
              current_step: 1,
              version: 1,
              last_save_attempt: new Date().toISOString()
            }
          });

        if (error) {
          console.error('[AnonymousRoute] Error initializing:', error);
          toast({
            title: "Error",
            description: "Failed to initialize session",
            variant: "destructive",
          });
        }
      }
    };

    initializeAnonymousSession();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};