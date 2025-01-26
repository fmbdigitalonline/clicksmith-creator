import { create } from 'zustand';
import { supabase } from "@/integrations/supabase/client";

interface CurrentSession {
  userId?: string;
  anonymousId?: string;
}

interface SessionState {
  migrationStatus: 'idle' | 'pending' | 'complete' | 'error';
  currentSession: CurrentSession;
  initializeSession: () => Promise<void>;
  clearMigration: () => void;
  setMigrationStatus: (status: SessionState['migrationStatus']) => void;
}

export const useSession = create<SessionState>((set) => ({
  migrationStatus: 'idle',
  currentSession: {},
  
  initializeSession: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check anonymous_usage table for any existing session
        const { data: anonymousData } = await supabase
          .from('anonymous_usage')
          .select('session_id')
          .eq('used', false)
          .single();

        set({
          currentSession: {
            userId: user.id,
            anonymousId: anonymousData?.session_id
          }
        });
      } else {
        // Handle anonymous session
        const anonymousId = localStorage.getItem('anonymous_session_id');
        if (anonymousId) {
          set({
            currentSession: {
              anonymousId
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
      // Reset session state on error
      set({
        currentSession: {},
        migrationStatus: 'error'
      });
    }
  },
  
  setMigrationStatus: (status) => set({ migrationStatus: status }),
  
  clearMigration: () => set({ migrationStatus: 'idle' })
}));

// Optional: Create a provider component for React context if needed
import { createContext, useContext, ReactNode } from 'react';

const SessionContext = createContext<ReturnType<typeof useSession> | null>(null);

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider = ({ children }: SessionProviderProps) => {
  return (
    <SessionContext.Provider value={useSession()}>
      {children}
    </SessionContext.Provider>
  );
};

// Custom hook to use the session context
export const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
};