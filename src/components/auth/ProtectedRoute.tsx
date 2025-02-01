import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMigrationLock } from "@/hooks/useMigrationLock";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const { isLocked } = useMigrationLock(user?.id);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('[ProtectedRoute] Auth error:', error);
          throw error;
        }

        if (!currentUser) {
          navigate('/login');
          return;
        }

        setUser(currentUser);
      } catch (error) {
        console.error('[ProtectedRoute] Unexpected error:', error);
        toast({
          title: "Authentication Error",
          description: "Please sign in again",
          variant: "destructive",
        });
        navigate('/login');
      }
    };

    checkUser();
  }, [navigate]);

  if (isLocked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Migration in Progress</h2>
          <p className="text-gray-600">Please wait while we complete your data migration...</p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
