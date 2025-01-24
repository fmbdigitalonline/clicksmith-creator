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
          const { data: existingProgress } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (existingProgress) {
            console.log('[WizardAuthentication] Found existing wizard progress:', existingProgress);
            // Update wizard state with existing progress
            onAnonymousDataChange({
              business_idea: existingProgress.business_idea,
              target_audience: existingProgress.target_audience,
              audience_analysis: existingProgress.audience_analysis,
              generated_ads: existingProgress.generated_ads || [],
              current_step: existingProgress.current_step || 1
            });
            return;
          }

          if (sessionId) {
            console.log('[WizardAuthentication] Found anonymous session to migrate:', sessionId);
            
            try {
              // Get the anonymous data
              const { data: anonData, error: anonError } = await supabase
                .from('anonymous_usage')
                .select('wizard_data, completed')
                .eq('session_id', sessionId)
                .maybeSingle();

              if (anonError) {
                console.error('[WizardAuthentication] Error fetching anonymous data:', anonError);
                return;
              }

              if (!anonData) {
                console.log('[WizardAuthentication] No anonymous data found for session:', sessionId);
                return;
              }

              const typedAnonData = anonData as AnonymousData;

              if (typedAnonData?.wizard_data) {
                console.log('[WizardAuthentication] Migrating data:', typedAnonData.wizard_data);
                
                const wizardData = {
                  user_id: user.id,
                  business_idea: typedAnonData.wizard_data.business_idea || null,
                  target_audience: typedAnonData.wizard_data.target_audience || null,
                  audience_analysis: typedAnonData.wizard_data.audience_analysis || null,
                  generated_ads: typedAnonData.wizard_data.generated_ads || [],
                  current_step: typedAnonData.wizard_data.current_step || 1,
                  version: 1
                };

                const { error: upsertError } = await supabase
                  .from('wizard_progress')
                  .upsert(wizardData);

                if (upsertError) {
                  console.error('[WizardAuthentication] Error upserting wizard_progress:', upsertError);
                  throw upsertError;
                }

                // Update wizard state with migrated data
                onAnonymousDataChange(typedAnonData.wizard_data);

                // Mark anonymous session as used
                const { error: updateError } = await supabase
                  .from('anonymous_usage')
                  .update({ used: true })
                  .eq('session_id', sessionId);

                if (updateError) {
                  console.error('[WizardAuthentication] Error marking session as used:', updateError);
                }

                localStorage.removeItem('anonymous_session_id');
                
                toast({
                  title: "Progress Migrated",
                  description: "Your previous work has been saved to your account.",
                });
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