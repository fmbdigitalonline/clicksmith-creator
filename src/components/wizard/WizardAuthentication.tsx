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

          // First, check for existing wizard progress
          const { data: existingProgress, error: progressError } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (progressError && progressError.code !== "PGRST116") {
            console.error('[WizardAuthentication] Error fetching wizard progress:', progressError);
            return;
          }

          // If there's existing progress, use that
          if (existingProgress) {
            console.log('[WizardAuthentication] Found existing wizard progress:', existingProgress);
            onAnonymousDataChange({
              business_idea: existingProgress.business_idea,
              target_audience: existingProgress.target_audience,
              audience_analysis: existingProgress.audience_analysis,
              generated_ads: existingProgress.generated_ads || [],
              current_step: existingProgress.current_step || 1,
            });

            // If we have a session ID, mark it as used since we're using existing progress
            if (sessionId) {
              await supabase
                .from('anonymous_usage')
                .update({ used: true })
                .eq('session_id', sessionId);
              localStorage.removeItem('anonymous_session_id');
            }
            return;
          }

          // No existing progress, check for anonymous session data
          if (sessionId) {
            console.log('[WizardAuthentication] Checking anonymous session:', sessionId);

            try {
              const { data: anonData, error: anonError } = await supabase
                .from('anonymous_usage')
                .select('wizard_data, completed, used')
                .eq('session_id', sessionId)
                .limit(1)
                .single();

              if (anonError && anonError.code !== "PGRST116") {
                console.error('[WizardAuthentication] Error fetching anonymous data:', anonError);
                return;
              }

              if (!anonData || anonData.used) {
                console.log('[WizardAuthentication] No unused anonymous data found for session:', sessionId);
                localStorage.removeItem('anonymous_session_id');
                return;
              }

              const typedAnonData = anonData as AnonymousData;

              if (typedAnonData?.wizard_data) {
                console.log('[WizardAuthentication] Attempting to migrate data for user:', user.id);

                // Use upsert with onConflict to handle duplicate user_id
                const { error: upsertError } = await supabase
                  .from('wizard_progress')
                  .upsert(
                    {
                      user_id: user.id,
                      business_idea: typedAnonData.wizard_data.business_idea,
                      target_audience: typedAnonData.wizard_data.target_audience,
                      audience_analysis: typedAnonData.wizard_data.audience_analysis,
                      generated_ads: typedAnonData.wizard_data.generated_ads || [],
                      current_step: typedAnonData.wizard_data.current_step || 1,
                      version: 1,
                    },
                    { onConflict: 'user_id' } // Explicitly handle conflicts on user_id
                  );

                if (upsertError) {
                  console.error('[WizardAuthentication] Upsert error:', upsertError);
                  if (upsertError.code === '23505') {
                    toast({
                      title: "Duplicate Record",
                      description: "A record for this user already exists.",
                      variant: "destructive",
                    });
                  }
                  return;
                }

                toast({
                  title: "Progress Migrated",
                  description: "Your previous work has been saved to your account.",
                });

                // Mark anonymous data as used
                await supabase
                  .from('anonymous_usage')
                  .update({ used: true })
                  .eq('session_id', sessionId);

                localStorage.removeItem('anonymous_session_id');

                // Get the final record to update the UI
                const { data: finalRecord } = await supabase
                  .from('wizard_progress')
                  .select('*')
                  .eq('user_id', user.id)
                  .single();

                if (finalRecord) {
                  onAnonymousDataChange({
                    business_idea: finalRecord.business_idea,
                    target_audience: finalRecord.target_audience,
                    audience_analysis: finalRecord.audience_analysis,
                    generated_ads: finalRecord.generated_ads || [],
                    current_step: finalRecord.current_step || 1,
                  });
                }
              }
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
