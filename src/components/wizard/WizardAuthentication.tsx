import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WizardData {
  business_idea?: any;
  target_audience?: any;
  audience_analysis?: any;
  generated_ads?: any[];
  current_step?: number;
}

interface AnonymousData {
  wizard_data: WizardData;
  completed: boolean;
}

interface WizardAuthenticationProps {
  onUserChange: (user: any) => void;
  onAnonymousDataChange: (data: any) => void;
}

const WizardAuthentication = ({ onUserChange, onAnonymousDataChange }: WizardAuthenticationProps) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const checkUser = async () => {
      try {
        console.log('[WizardAuthentication] Starting user check...');
        const { data: { user }, error: sessionError } = await supabase.auth.getUser();

        if (sessionError) {
          console.error('[WizardAuthentication] Session error:', sessionError);
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(checkUser, 1000 * retryCount);
            return;
          }
          setAuthError(sessionError.message);
          return;
        }

        if (!isMounted) return;
        onUserChange(user);
        setAuthError(null);

        if (user) {
          const sessionId = localStorage.getItem('anonymous_session_id');

          // Check for existing progress first
          const { data: existingProgress } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (existingProgress) {
            console.log('[WizardAuthentication] Existing progress found');
            onAnonymousDataChange({
              business_idea: existingProgress.business_idea,
              target_audience: existingProgress.target_audience,
              audience_analysis: existingProgress.audience_analysis,
              generated_ads: existingProgress.generated_ads || [],
              current_step: existingProgress.current_step || 1,
            });

            if (sessionId) {
              await supabase
                .from('anonymous_usage')
                .update({ used: true })
                .eq('session_id', sessionId);
              localStorage.removeItem('anonymous_session_id');
            }
            return;
          }

          if (sessionId) {
            console.log('[WizardAuthentication] Migrating anonymous data');
            
            try {
              const { data: anonData } = await supabase
                .from('anonymous_usage')
                .select('wizard_data, used')
                .eq('session_id', sessionId)
                .single();

              if (!anonData?.wizard_data || anonData.used) {
                localStorage.removeItem('anonymous_session_id');
                return;
              }

              // Atomic UPSERT operation
              const { error: upsertError } = await supabase
                .from('wizard_progress')
                .upsert(
                  {
                    user_id: user.id,
                    ...anonData.wizard_data,
                    generated_ads: anonData.wizard_data.generated_ads || [],
                    current_step: anonData.wizard_data.current_step || 1,
                    version: 1,
                  },
                  {
                    onConflict: 'user_id',
                    returning: 'minimal'
                  }
                );

              if (upsertError) {
                if (upsertError.code === '23505') {
                  // Handle duplicate by fetching existing record
                  const { data: existing } = await supabase
                    .from('wizard_progress')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                  if (existing) {
                    onAnonymousDataChange({
                      business_idea: existing.business_idea,
                      target_audience: existing.target_audience,
                      audience_analysis: existing.audience_analysis,
                      generated_ads: existing.generated_ads || [],
                      current_step: existing.current_step || 1,
                    });
                  }
                } else {
                  throw upsertError;
                }
              } else {
                toast({
                  title: "Progress Migrated",
                  description: "Your previous work has been saved to your account.",
                });
              }

              // Mark anonymous data as used
              await supabase
                .from('anonymous_usage')
                .update({ used: true })
                .eq('session_id', sessionId);

              localStorage.removeItem('anonymous_session_id');

            } catch (error) {
              console.error('[WizardAuthentication] Migration error:', error);
              toast({
                title: "Migration Error",
                description: "Failed to migrate your previous work. Please try again.",
                variant: "destructive",
              });
            }
          }
        }
      } catch (error) {
        console.error('[WizardAuthentication] Error in checkUser:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(checkUser, 1000 * retryCount);
        } else {
          setAuthError('Failed to check authentication status. Please refresh the page.');
        }
      }
    };

    checkUser();
    return () => {
      isMounted = false;
    };
  }, [onUserChange, onAnonymousDataChange, toast]);

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
