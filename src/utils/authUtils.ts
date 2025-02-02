import { AuthError, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second

export const handleAuthStateChange = async (
  event: string,
  session: Session | null,
  onSuccess: (session: Session | null) => void,
  onError: (error: string) => void
) => {
  console.log('[Auth] State changed:', event, 'Session:', session?.user?.id);
  
  try {
    switch (event) {
      case 'SIGNED_IN':
        if (session?.user) {
          // Persist session
          localStorage.setItem('supabase.auth.token', session.access_token);
          onSuccess(session);
        }
        break;
      case 'SIGNED_OUT':
        localStorage.removeItem('supabase.auth.token');
        onSuccess(null);
        break;
      case 'TOKEN_REFRESHED':
        if (session) {
          localStorage.setItem('supabase.auth.token', session.access_token);
          onSuccess(session);
        }
        break;
      case 'USER_UPDATED':
        onSuccess(session);
        break;
    }
  } catch (error) {
    console.error('[Auth] Error handling auth state change:', error);
    onError('Error updating authentication state');
  }
};

export const refreshSessionWithRetry = async (
  retryCount = 0
): Promise<Session | null> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      throw error;
    }
    
    if (!session && retryCount < MAX_RETRIES) {
      const delay = INITIAL_DELAY * Math.pow(2, retryCount);
      console.log(`[Auth] Retrying session refresh in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return refreshSessionWithRetry(retryCount + 1);
    }
    
    return session;
  } catch (error) {
    if (error instanceof AuthError && retryCount < MAX_RETRIES) {
      const delay = INITIAL_DELAY * Math.pow(2, retryCount);
      console.log(`[Auth] Auth error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return refreshSessionWithRetry(retryCount + 1);
    }
    throw error;
  }
};

export const AUTH_TIMEOUT = 30000; // 30 seconds

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number = AUTH_TIMEOUT
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Authentication operation timed out'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
};