import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate a random email and password for the anonymous user
    const anonymousEmail = `anon_${crypto.randomUUID()}@temporary.user`;
    const anonymousPassword = crypto.randomUUID();

    console.log('[create-anonymous-session] Creating anonymous user:', anonymousEmail);

    // Create the anonymous user
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email: anonymousEmail,
      password: anonymousPassword,
      email_confirm: true
    });

    if (signUpError) {
      console.error('[create-anonymous-session] Error creating user:', signUpError);
      throw signUpError;
    }

    // Sign in as the anonymous user to get a session
    const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: anonymousEmail,
      password: anonymousPassword,
    });

    if (signInError || !session) {
      console.error('[create-anonymous-session] Error signing in:', signInError);
      throw signInError || new Error('No session created');
    }

    console.log('[create-anonymous-session] Anonymous session created successfully');

    return new Response(
      JSON.stringify({
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          user: {
            id: session.user.id,
            email: session.user.email,
          },
        },
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[create-anonymous-session] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});