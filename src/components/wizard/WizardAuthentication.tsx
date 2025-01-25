import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WizardData {
  id?: string;
  user_id?: string;
  business_idea?: any;
  target_audience?: any;
  audience_analysis?: any;
  generated_ads?: any[] | null;
  current_step?: number;
  version?: number;
  created_at?: string;
  updated_at?: string;
  last_save_attempt?: string | null;
  selected_hooks?: any[] | null;
  ad_format?: any;
  video_ad_preferences?: any;
}

interface WizardAuthenticationProps {
  onUserChange: (user: any) => void;
  onAnonymousDataChange: (data: WizardData) => void;
}

const WizardAuthentication = ({ onUserChange, onAnonymousDataChange }: WizardAuthenticationProps) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();

  // Atomic migration function with improved error handling
  const migrateUserProgress = async (user_id: string, session_id: string): Promise<WizardData | null> => {
    try {
      console.log('[Migration] Starting atomic migration for user:', user_id);
      
      const { data, error } = await supabase
        .rpc('atomic_migration', { user_id, session_id })
        .single();

      if (error) {
        console.error('[Migration] Database error:', error);
        toast({
          title: "Migration Error",
          description: "Failed to migrate your progress. Please try again.",
          variant: "destructive",
        });
        throw error;
      }

      if (!data) {
        console.log('[Migration] No data to migrate');
        return null;
      }

      // Ensure generated_ads is an array
      if (data.generated_ads) {
        try {
          data.generated_ads = typeof data.generated_ads === 'string' 
            ? JSON.parse(data.generated_ads) 
            : data.generated_ads;
        } catch (parseError) {
          console.error('[Migration] Error parsing generated_ads:', parseError);
          data.generated_ads = [];
        }
      }

      console.log('[Migration] Successfully migrated data:', data);
      return data;
    } catch (error) {
      console.error('[Migration] Error:', error);
      throw error;
    }
  };

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const checkUser = async () => {
      try {
        console.log('[Auth] Starting user check');
        const { data: { user }, error } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (error) throw error;

        onUserChange(user);
        
        if (user) {
          const sessionId = localStorage.getItem('anonymous_session_id');
          if (sessionId) {
            console.log('[Migration] Starting atomic migration');
            try {
              const migratedData = await migrateUserProgress(user.id, sessionId);

              if (migratedData) {
                onAnonymousDataChange(migratedData);
                localStorage.removeItem('anonymous_session_id');
                toast({
                  title: "Progress Migrated",
                  description: "Your previous work has been saved to your account.",
                });
              }
            } catch (error) {
              console.error('[Migration] Error:', error);
              // Fallback to existing data
              const { data: existing } = await supabase
                .from('wizard_progress')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

              if (existing) onAnonymousDataChange(existing);
            }
          }
        }
      } catch (error) {
        console.error('[Auth] Error:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(checkUser, 1000 * retryCount);
        } else {
          setAuthError('Authentication check failed. Please refresh.');
          toast({
            title: "Authentication Error",
            description: "Failed to check authentication status. Please refresh the page.",
            variant: "destructive",
          });
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