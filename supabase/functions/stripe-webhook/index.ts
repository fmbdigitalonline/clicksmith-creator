import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Stripe } from 'https://esm.sh/stripe@14.21.0';
import { baseHeaders, createErrorResponse, createSuccessResponse } from './utils.ts';
import { handleCheckoutSession } from './handlers/checkoutHandler.ts';

console.log('Webhook handler starting...');

serve(async (req: Request) => {
  console.log('Received request:', req.method);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: baseHeaders });
  }

  try {
    const rawBody = await req.text();
    console.log('Request body length:', rawBody.length);

    const stripeSignature = req.headers.get('stripe-signature');
    console.log('Stripe signature present:', !!stripeSignature);

    if (!stripeSignature) {
      return createErrorResponse('Stripe signature required', 400);
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
      // Add authorization header to Stripe requests
      apiKey: Deno.env.get('STRIPE_SECRET_KEY') ?? '',
    });

    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    console.log('Webhook secret present:', !!webhookSecret);

    if (!webhookSecret) {
      return createErrorResponse('Webhook secret not configured', 500);
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, stripeSignature, webhookSecret);
      console.log('Event verified:', event.type);
    } catch (err) {
      console.error('Stripe signature verification failed:', err.message);
      return createErrorResponse('Invalid signature', 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          }
        }
      }
    );

    if (event.type === 'checkout.session.completed') {
      await handleCheckoutSession(event.data.object as Stripe.Checkout.Session, supabaseAdmin);
    }

    return createSuccessResponse({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return createErrorResponse(error.message, 500);
  }
});