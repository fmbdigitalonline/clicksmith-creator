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

interface WizardAuthenticationProps {
  onUserChange: (user: any) => void;
  onAnonymousDataChange: (data: WizardData) => void;
}

const WizardAuthentication = ({ onUserChange, onAnonymousDataChange }: WizardAuthenticationProps) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();

  const mergeProgressData = (existing: WizardData, anonymous: WizardData): WizardData => ({
    business_idea: existing.business_idea || anonymous.business_idea,
    target_audience: existing.target_audience || anonymous.target_audience,
    audience_analysis: existing.audience_analysis 
      ? `${existing.audience_analysis}\n${anonymous.audience_analysis}`
      : anonymous.audience_analysis,
    generated_ads: [...(existing.generated_ads || []), ...(anonymous.generated_ads || [])],
    current_step: Math.max(existing.current_step || 0, anonymous.current_step || 1)
  });

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const handleMigration = async (user: any, sessionId: string) => {
      try {
        // 1. Get existing progress WITH LOCKING
        const { data: existing } = await supabase
          .from('wizard_progress')
          .select('*')
          .eq('user_id', user.id)
          .single();

        // 2. Get anonymous data
        const { data: anonData } = await supabase
          .from('anonymous_usage')
          .select('wizard_data')
          .eq('session_id', sessionId)
          .single();

        if (!anonData?.wizard_data) {
          localStorage.removeItem('anonymous_session_id');
          return;
        }

        // 3. Prepare merged data
        const mergedData = existing 
          ? mergeProgressData(existing, anonData.wizard_data)
          : anonData.wizard_data;

        // 4. Atomic upsert operation
        const { error } = await supabase
          .from('wizard_progress')
          .upsert({
            ...mergedData,
            user_id: user.id,
            version: (existing?.version || 0) + 1
          }, {
            onConflict: 'user_id',
            returning: 'minimal'
          });

        if (error) throw error;

        // 5. Update UI with merged data
        onAnonymousDataChange(mergedData);
        
        // 6. Cleanup
        await supabase
          .from('anonymous_usage')
          .update({ used: true })
          .eq('session_id', sessionId);

        localStorage.removeItem('anonymous_session_id');

      } catch (error) {
        console.error('Migration error:', error);
        // Fallback to existing data
        const { data: existing } = await supabase
          .from('wizard_progress')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (existing) onAnonymousDataChange(existing);
      }
    };

    const checkUser = async () => {
      try {
        console.log('[Auth] Starting user check');
        const { data: { user }, error } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (error) throw error;

        onUserChange(user);
        
        if (user) {
          const sessionId = localStorage.getItem('anonymous_session_id');
          if (sessionId) await handleMigration(user, sessionId);
        }
      } catch (error) {
        console.error('[Auth] Error:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(checkUser, 1000 * retryCount);
        } else {
          setAuthError('Authentication check failed. Please refresh.');
        }
      }
    };

    checkUser();
    return () => { isMounted = false; };
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
