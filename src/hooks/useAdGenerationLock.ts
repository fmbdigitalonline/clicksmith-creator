import { useState, useRef, useCallback } from 'react';

export const useAdGenerationLock = () => {
  const [isLocked, setIsLocked] = useState(false);
  const lockTimeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  const acquireLock = useCallback(() => {
    if (isLocked) return false;
    setIsLocked(true);
    // Auto-release lock after 30 seconds as safety
    lockTimeoutRef.current = setTimeout(() => {
      setIsLocked(false);
    }, 30000);
    return true;
  }, [isLocked]);

  const releaseLock = useCallback(() => {
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
    }
    setIsLocked(false);
    retryCountRef.current = 0;
  }, []);

  const canRetry = useCallback(() => {
    return retryCountRef.current < MAX_RETRIES;
  }, []);

  const incrementRetry = useCallback(() => {
    retryCountRef.current += 1;
    return retryCountRef.current;
  }, []);

  return {
    isLocked,
    acquireLock,
    releaseLock,
    canRetry,
    incrementRetry,
  };
};