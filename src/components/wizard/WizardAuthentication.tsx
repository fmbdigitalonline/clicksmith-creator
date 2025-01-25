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

interface MigrationResult {
  id: string;
  user_id: string;
  business_idea: any;
  target_audience: any;
  audience_analysis: any;
  generated_ads: any[] | string | null;
  current_step: number;
  version: number;
  created_at: string;
  updated_at: string;
  last_save_attempt: string | null;
  selected_hooks: any[] | null;
  ad_format: any;
  video_ad_preferences: any;
}

interface WizardAuthenticationProps {
  onUserChange: (user: any) => void;
  onAnonymousDataChange: (data: WizardData) => void;
}

const WizardAuthentication = ({ onUserChange, onAnonymousDataChange }: WizardAuthenticationProps) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();

  const migrateUserProgress = async (user_id: string, session_id: string): Promise<WizardData | null> => {
    try {
      console.log('[Migration] Starting atomic migration for user:', user_id);
      
      const { data: migrationResult, error: migrationError } = await supabase
        .rpc('atomic_migration', { user_id, session_id })
        .maybeSingle();

      if (migrationError) {
        console.error('[Migration] Database error:', migrationError);
        toast({
          title: "Migration Error",
          description: "Failed to migrate your progress. Please try again.",
          variant: "destructive",
        });
        throw migrationError;
      }

      if (!migrationResult) {
        console.log('[Migration] No data to migrate');
        return null;
      }

      const result = migrationResult as MigrationResult;

      const processedData: WizardData = {
        id: result.id,
        user_id: result.user_id,
        business_idea: result.business_idea,
        target_audience: result.target_audience,
        audience_analysis: result.audience_analysis,
        generated_ads: Array.isArray(result.generated_ads) 
          ? result.generated_ads 
          : typeof result.generated_ads === 'string'
          ? JSON.parse(result.generated_ads)
          : [],
        current_step: result.current_step,
        version: result.version,
        created_at: result.created_at,
        updated_at: result.updated_at,
        last_save_attempt: result.last_save_attempt,
        selected_hooks: Array.isArray(result.selected_hooks) 
          ? result.selected_hooks 
          : [],
        ad_format: result.ad_format,
        video_ad_preferences: result.video_ad_preferences
      };

      console.log('[Migration] Successfully migrated data:', processedData);
      return processedData;
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

        if (error) {
          console.error('[Auth] Error:', error);
          throw error;
        }

        // Handle anonymous users
        if (!user) {
          console.log('[Auth] No authenticated user found (anonymous session)');
          return;
        }

        onUserChange(user);
        
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
            const { data: existing } = await supabase
              .from('wizard_progress')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle();

            if (existing) {
              const result = existing as MigrationResult;
              const processedExisting: WizardData = {
                id: result.id,
                user_id: result.user_id,
                business_idea: result.business_idea,
                target_audience: result.target_audience,
                audience_analysis: result.audience_analysis,
                generated_ads: Array.isArray(result.generated_ads)
                  ? result.generated_ads
                  : typeof result.generated_ads === 'string'
                  ? JSON.parse(result.generated_ads)
                  : [],
                current_step: result.current_step,
                version: result.version,
                created_at: result.created_at,
                updated_at: result.updated_at,
                last_save_attempt: result.last_save_attempt,
                selected_hooks: Array.isArray(result.selected_hooks) 
                  ? result.selected_hooks 
                  : [],
                ad_format: result.ad_format,
                video_ad_preferences: result.video_ad_preferences
              };
              onAnonymousDataChange(processedExisting);
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
