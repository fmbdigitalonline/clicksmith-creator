import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from '@supabase/supabase-js';

let realtimeChannel: RealtimeChannel | null = null;

export const initializeSupabaseInterceptors = () => {
  console.log('[Supabase] Initializing interceptors');

  // Set up realtime subscription monitoring
  realtimeChannel = supabase
    .channel('system_monitoring')
    .on('system', { event: '*' }, (payload) => {
      console.log('[Supabase] System event:', payload);
    })
    .on('presence', { event: 'sync' }, () => {
      console.log('[Supabase] Presence sync event');
    })
    .on('presence', { event: 'join' }, ({ key, currentPresences, newPresences }) => {
      console.log('[Supabase] Presence join:', { key, currentPresences, newPresences });
    })
    .on('presence', { event: 'leave' }, ({ key, currentPresences, leftPresences }) => {
      console.log('[Supabase] Presence leave:', { key, currentPresences, leftPresences });
    })
    .on('broadcast', { event: 'cursor-pos' }, (payload) => {
      console.log('[Supabase] Broadcast event:', payload);
    })
    .subscribe((status) => {
      console.log('[Supabase] Channel status:', status);
    });

  // Monitor all database changes
  const dbChannel = supabase
    .channel('db_changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
      console.log('[Supabase] Database change:', {
        table: payload.table,
        eventType: payload.eventType,
        new: payload.new,
        old: payload.old
      });
    })
    .subscribe();

  // Add error monitoring using the correct API
  supabase.channel('error_monitoring').subscribe((status, err) => {
    if (err) {
      console.error('[Supabase] Realtime error:', err);
    }
  });

  return () => {
    console.log('[Supabase] Cleaning up interceptors');
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }
    supabase.removeChannel(dbChannel);
  };
};