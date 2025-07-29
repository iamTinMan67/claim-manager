import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data } = await supabaseClient.auth.getUser(token)
    const user = data.user

    if (!user) {
      throw new Error('No user found')
    }

    const { amount, currency = 'gbp', payment_type, claim_id, guest_email, metadata = {} } = await req.json()

    // Create or retrieve Stripe customer
    let customer
    const { data: existingCustomer } = await supabaseClient
      .from('payment_transactions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .single()

    if (existingCustomer?.stripe_customer_id) {
      customer = await stripe.customers.retrieve(existingCustomer.stripe_customer_id)
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to pence/cents
      currency,
      customer: customer.id,
      metadata: {
        user_id: user.id,
        payment_type,
        claim_id: claim_id || '',
        guest_email: guest_email || '',
        ...metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    // Store payment transaction in database
    const { error: dbError } = await supabaseClient
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_customer_id: customer.id,
        amount: Math.round(amount * 100),
        currency,
        status: 'pending',
        payment_type,
        claim_id,
        guest_email,
        metadata,
      })

    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error('Failed to store payment transaction')
    }

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})