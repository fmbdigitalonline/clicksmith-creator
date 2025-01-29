import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AnonymousRoute } from "@/components/auth/AnonymousRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { SidebarProvider } from "@/components/ui/sidebar";
import { OnboardingDialog } from "@/components/onboarding/OnboardingDialog";
import Login from "@/pages/Login";
import Projects from "@/pages/Projects";
import Settings from "@/pages/Settings";
import Pricing from "@/pages/Pricing";
import AdWizard from "@/components/AdWizard";
import Dashboard from "@/pages/Dashboard";
import { SavedAdsGallery } from "@/components/gallery/SavedAdsGallery";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        console.log('Checking authentication status...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (mounted) {
          console.log('Auth status:', session ? 'authenticated' : 'not authenticated');
          setIsAuthenticated(!!session);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (mounted) {
          setIsAuthenticated(false);
          setIsLoading(false);
          toast({
            title: "Authentication Error",
            description: "There was an error checking your authentication status.",
            variant: "destructive",
          });
        }
      }
    };

    checkAuth();

    // Store the unsubscribe function directly
    const unsubscribe = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event);
      if (mounted) {
        setIsAuthenticated(!!session);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      // Call the unsubscribe function directly
      unsubscribe();
    };
  }, [toast]);

  if (isLoading) {
    console.log('App is loading...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  console.log('Rendering app with auth status:', isAuthenticated);
  
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <Router>
          <Routes>
            <Route path="/login" element={
              isAuthenticated ? <Navigate to="/ad-wizard/new" replace /> : <Login />
            } />
            <Route path="/pricing" element={<Pricing />} />
            <Route
              path="/"
              element={
                <Navigate to="/ad-wizard/new" replace />
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Projects />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Settings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/saved-ads"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SavedAdsGallery />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ad-wizard/new"
              element={
                <AnonymousRoute>
                  <AppLayout>
                    <AdWizard />
                  </AppLayout>
                </AnonymousRoute>
              }
            />
            <Route
              path="/ad-wizard/:projectId"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AdWizard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/ad-wizard/new" replace />} />
          </Routes>
          <OnboardingDialog />
          <Toaster />
        </Router>
      </SidebarProvider>
    </QueryClientProvider>
  );
}

export default App;