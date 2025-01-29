import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import Index from "@/pages/Index";
import Pricing from "@/pages/Pricing";
import AdWizard from "@/components/AdWizard";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AnonymousRoute } from "@/components/auth/AnonymousRoute";

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setIsAuthenticated(!!session);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        if (mounted) {
          setIsAuthenticated(false);
          toast({
            title: "Authentication Error",
            description: "There was an error checking your authentication status.",
            variant: "destructive",
          });
        }
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event);
      if (mounted) {
        setIsAuthenticated(!!session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [toast]);

  if (isAuthenticated === null) {
    return null;
  }

  return (
    <>
      <Toaster />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Index />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <Projects />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ad-wizard/*"
            element={<AdWizard />}
          />
          <Route
            path="/login"
            element={
              <AnonymousRoute>
                <Login />
              </AnonymousRoute>
            }
          />
        </Route>
      </Routes>
    </>
  );
};

export default App;