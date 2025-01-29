import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Store the current path if coming from the wizard
    if (location.pathname.includes('/ad-wizard')) {
      sessionStorage.setItem('redirectUrl', location.pathname);
    }

    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const redirectUrl = sessionStorage.getItem('redirectUrl') || '/';
        sessionStorage.removeItem('redirectUrl'); // Clean up
        navigate(redirectUrl);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        // Wait a moment for migration to complete
        setTimeout(() => {
          const redirectUrl = sessionStorage.getItem('redirectUrl') || '/';
          sessionStorage.removeItem('redirectUrl'); // Clean up
          
          toast({
            title: "Welcome back!",
            description: "You have successfully logged in.",
          });
          
          navigate(redirectUrl);
        }, 1000); // Small delay to ensure migration completes
      } else if (event === 'SIGNED_OUT') {
        toast({
          title: "Signed out",
          description: "You have been signed out successfully.",
        });
      } else if (event === 'USER_UPDATED') {
        toast({
          title: "Profile updated",
          description: "Your profile has been updated successfully.",
        });
      } else if (event === 'PASSWORD_RECOVERY') {
        toast({
          title: "Password Reset Email Sent",
          description: "Please check your email for password reset instructions.",
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname, toast]);

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen py-8">
      <Card className="w-full max-w-md p-8">
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            style: {
              button: { background: 'rgb(59 130 246)', color: 'white' },
              anchor: { color: 'rgb(59 130 246)' },
              input: { background: 'white' },
              message: { color: 'rgb(239 68 68)' },
            },
            className: {
              container: 'space-y-4',
              button: 'w-full',
              input: 'w-full',
              message: 'text-sm font-medium text-destructive',
            }
          }}
          redirectTo={`${window.location.origin}/`}
          onlyThirdPartyProviders={false}
          providers={[]}
          magicLink={false}
          showLinks={true}
          view="sign_in"
          localization={{
            variables: {
              sign_up: {
                email_label: 'Email address',
                password_label: 'Create a Password (minimum 6 characters)',
                email_input_placeholder: 'Your email address',
                password_input_placeholder: 'Password (minimum 6 characters)',
                button_label: 'Sign up',
                loading_button_label: 'Creating account ...',
                link_text: "Don't have an account? Sign up",
                confirmation_text: 'Check your email for the confirmation link'
              },
              sign_in: {
                email_label: 'Email address',
                password_label: 'Your password (minimum 6 characters)',
                email_input_placeholder: 'Your email address',
                password_input_placeholder: 'Password (minimum 6 characters)',
                button_label: 'Sign in',
                loading_button_label: 'Signing in ...',
                link_text: 'Already have an account? Sign in'
              }
            }
          }}
        />
      </Card>
    </div>
  );
};

export default Login;