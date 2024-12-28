import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { priceId } = await req.json();
    
    if (!priceId) {
      throw new Error('Price ID is required');
    }

    console.log('Received price ID:', priceId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Verify the price exists in our database
    const { data: planData, error: planError } = await supabaseClient
      .from('plans')
      .select('*')
      .eq('stripe_price_id', priceId)
      .single();

    if (planError || !planData) {
      console.error('Plan not found:', planError);
      throw new Error(`Invalid price ID: ${priceId}`);
    }

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user?.email) {
      throw new Error('User email not found');
    }

    console.log('Creating Stripe instance...');
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Check if customer exists
    console.log('Checking for existing customer...');
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    let customerId = customers.data[0]?.id;

    // Create customer if doesn't exist
    if (!customerId) {
      console.log('Creating new customer...');
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabaseUid: user.id,
        },
      });
      customerId = customer.id;
    }

    // Determine if this is a one-time payment or subscription based on the plan price
    const isOneTimePayment = planData.price === 10;

    // Create checkout session with appropriate mode and configuration
    console.log('Creating checkout session...');
    const sessionConfig = {
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: isOneTimePayment ? 'payment' : 'subscription',
      success_url: `${req.headers.get('origin')}/settings?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/pricing`,
      metadata: {
        supabaseUid: user.id,
        planId: planData.id,
      },
    };

    // Add subscription_data only for subscription mode
    if (!isOneTimePayment) {
      Object.assign(sessionConfig, {
        subscription_data: {
          metadata: {
            supabaseUid: user.id,
            planId: planData.id,
          },
        },
      });
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log('Checkout session created successfully');
    return new Response(
      JSON.stringify({ url: session.url }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});