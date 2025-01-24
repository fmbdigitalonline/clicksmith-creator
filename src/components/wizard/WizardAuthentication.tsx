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
              current_step: existingProgress.current_step || 1
            });
            return;
          }

          // No existing progress, check for anonymous session data regardless of whether this is a new user
          if (sessionId) {
            console.log('[WizardAuthentication] Checking anonymous session:', sessionId);
            
            try {
              // First check if we already have a record for this user
              const { data: existingRecord, error: existingError } = await supabase
                .from('wizard_progress')
                .select('*')
                .eq('user_id', user.id)
                .single();

              if (existingError && existingError.code !== 'PGRST116') {
                console.error('[WizardAuthentication] Error checking existing record:', existingError);
                return;
              }

              // If we already have a record, skip migration
              if (existingRecord) {
                console.log('[WizardAuthentication] User already has wizard progress, skipping migration');
                localStorage.removeItem('anonymous_session_id');
                return;
              }

              const { data: anonData, error: anonError } = await supabase
                .from('anonymous_usage')
                .select('wizard_data, completed, used')
                .eq('session_id', sessionId)
                .maybeSingle();

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
                console.log('[WizardAuthentication] Attempting to migrate data');

                // Double-check right before insert to prevent race conditions
                const { count } = await supabase
                  .from('wizard_progress')
                  .select('*', { count: 'exact', head: true })
                  .eq('user_id', user.id);

                if (count > 0) {
                  console.log('[WizardAuthentication] Skipping insert - user already has progress');
                  return;
                }

                // Insert new record (not upsert since we already checked for existence)
                const { error: insertError } = await supabase
                  .from('wizard_progress')
                  .insert({
                    user_id: user.id,
                    business_idea: typedAnonData.wizard_data.business_idea || null,
                    target_audience: typedAnonData.wizard_data.target_audience || null,
                    audience_analysis: typedAnonData.wizard_data.audience_analysis || null,
                    generated_ads: typedAnonData.wizard_data.generated_ads || [],
                    current_step: typedAnonData.wizard_data.current_step || 1,
                    version: 1
                  });

                if (insertError) {
                  console.error('[WizardAuthentication] Error inserting wizard_progress:', insertError);
                  return;
                }

                // Only mark anonymous data as used after successful insertion
                const { error: markUsedError } = await supabase
                  .from('anonymous_usage')
                  .update({ used: true })
                  .eq('session_id', sessionId);

                if (markUsedError) {
                  console.error('[WizardAuthentication] Error marking session as used:', markUsedError);
                }

                onAnonymousDataChange(typedAnonData.wizard_data);
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
