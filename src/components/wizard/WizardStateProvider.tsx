import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { initializeSupabaseInterceptors } from "@/utils/supabaseInterceptor";

const WizardStateContext = createContext<ReturnType<typeof useAdWizardState> | undefined>(undefined);

export const useWizardState = () => {
  const context = useContext(WizardStateContext);
  if (!context) {
    throw new Error('useWizardState must be used within a WizardStateProvider');
  }
  return context;
};

export const WizardStateProvider = ({ children }: { children: ReactNode }) => {
  const state = useAdWizardState();
  const { toast } = useToast();

  useEffect(() => {
    // Initialize Supabase interceptors
    const cleanup = initializeSupabaseInterceptors();

    // Set up wizard progress monitoring
    const channel = supabase
      .channel('wizard_progress_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wizard_progress',
        },
        (payload: any) => {
          console.log('[WizardStateProvider] Received real-time update:', payload);

          // Ignore migration-related changes
          if (payload.new?.is_migration) {
            console.log('[WizardStateProvider] Ignoring migration-related change');
            return;
          }

          // Handle other changes
          if (payload.eventType === 'UPDATE') {
            console.log('[WizardStateProvider] Processing wizard progress update');
            toast({
              title: "Progress Updated",
              description: "Your progress has been updated in real-time",
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[WizardStateProvider] Subscription status:', status);
      });

    return () => {
      console.log('[WizardStateProvider] Cleaning up subscriptions');
      cleanup();
      supabase.removeChannel(channel);
    };
  }, [toast]);
  
  return (
    <WizardStateContext.Provider value={state}>
      {children}
    </WizardStateContext.Provider>
  );
};