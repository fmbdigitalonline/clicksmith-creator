import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/hooks/use-toast";

export const AnonymousRoute = ({ children }: { children: React.ReactNode }) => {
  const [canAccess, setCanAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkAnonymousAccess = async () => {
      try {
        // Check if user is already authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setCanAccess(true);
          setIsLoading(false);
          return;
        }

        // Get or create session ID from localStorage
        let sessionId = localStorage.getItem('anonymous_session_id');
        if (!sessionId) {
          sessionId = uuidv4();
          localStorage.setItem('anonymous_session_id', sessionId);
        }

        // Check if this session has already been used
        const { data: usage, error } = await supabase
          .from('anonymous_usage')
          .select('*')
          .eq('session_id', sessionId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking anonymous usage:', error);
          setCanAccess(false);
          return;
        }

        if (!usage) {
          // First time user - create usage record
          const { error: insertError } = await supabase
            .from('anonymous_usage')
            .insert([{ session_id: sessionId, used: false }]);

          if (insertError) {
            console.error('Error creating anonymous usage:', insertError);
            setCanAccess(false);
            return;
          }
          setCanAccess(true);
        } else if (!usage.used) {
          // Session exists but hasn't been used yet
          setCanAccess(true);
        } else {
          // Session has been used
          toast({
            title: "Trial Expired",
            description: "Please sign up to continue using the app.",
            variant: "destructive",
          });
          setCanAccess(false);
        }
      } catch (error) {
        console.error('Error in anonymous access check:', error);
        setCanAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAnonymousAccess();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!canAccess) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};