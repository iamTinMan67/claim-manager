import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
})

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()
  
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  // Log webhook event
  await supabaseClient
    .from('payment_webhooks')
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      raw_data: event,
    })

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
        break
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // Mark webhook as processed
    await supabaseClient
      .from('payment_webhooks')
      .update({ processed: true })
      .eq('stripe_event_id', event.id)

    return new Response('Webhook processed successfully', { status: 200 })
  } catch (error) {
    console.error('Error processing webhook:', error)
    
    // Log error
    await supabaseClient
      .from('payment_webhooks')
      .update({ 
        processed: false, 
        error_message: error.message 
      })
      .eq('stripe_event_id', event.id)

    return new Response('Webhook processing failed', { status: 500 })
  }
})

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Update payment transaction status
  const { error: updateError } = await supabaseClient
    .from('payment_transactions')
    .update({ status: 'succeeded' })
    .eq('stripe_payment_intent_id', paymentIntent.id)

  if (updateError) {
    throw new Error(`Failed to update payment transaction: ${updateError.message}`)
  }

  // If this is a guest access payment, update claim share
  const metadata = paymentIntent.metadata
  if (metadata.payment_type === 'guest_access' && metadata.claim_id && metadata.guest_email) {
    // Get the payment transaction
    const { data: transaction } = await supabaseClient
      .from('payment_transactions')
      .select('id, user_id')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .single()

    if (transaction) {
      // Get guest user ID from email
      const { data: guestProfile } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('email', metadata.guest_email)
        .single()

      if (guestProfile) {
        // Create or update claim share with payment verification
        const { error: shareError } = await supabaseClient
          .from('claim_shares')
          .upsert({
            claim_id: metadata.claim_id,
            owner_id: transaction.user_id,
            shared_with_id: guestProfile.id,
            permission: 'view',
            can_view_evidence: false,
            payment_transaction_id: transaction.id,
            payment_verified: true,
            donation_paid: true,
            donation_amount: Math.round(paymentIntent.amount / 100), // Convert back to pounds
            donation_paid_at: new Date().toISOString(),
            stripe_payment_intent_id: paymentIntent.id,
          })

        if (shareError) {
          throw new Error(`Failed to update claim share: ${shareError.message}`)
        }
      }
    }
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  await supabaseClient
    .from('payment_transactions')
    .update({ status: 'failed' })
    .eq('stripe_payment_intent_id', paymentIntent.id)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  
  // Get user from customer ID
  const { data: transaction } = await supabaseClient
    .from('payment_transactions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .limit(1)
    .single()

  if (!transaction) return

  // Get subscription tier from price ID
  const priceId = subscription.items.data[0]?.price.id
  const { data: tier } = await supabaseClient
    .from('subscription_tiers')
    .select('id')
    .eq('stripe_price_id', priceId)
    .single()

  if (!tier) return

  // Upsert user subscription
  await supabaseClient
    .from('user_subscriptions')
    .upsert({
      user_id: transaction.user_id,
      tier_id: tier.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await supabaseClient
    .from('user_subscriptions')
    .update({ 
      status: 'canceled',
      canceled_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Handle successful subscription payments
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
    await handleSubscriptionUpdated(subscription)
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Handle failed subscription payments
  if (invoice.subscription) {
    await supabaseClient
      .from('user_subscriptions')
      .update({ status: 'past_due' })
      .eq('stripe_subscription_id', invoice.subscription as string)
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // Handle successful one-time payments for collaboration packages
  const userId = session.metadata?.userId || session.metadata?.user_id
  const packageType = session.metadata?.packageType || session.metadata?.package_type
  const packageName = session.metadata?.packageName || session.metadata?.package_name

  if (!userId) {
    console.error('Missing user ID in checkout session metadata:', session.id)
    return
  }

  // Only process app development donations (not regular claim donations)
  if (packageType && packageName) {
    // Update user's subscription in the subscribers table
    const { error } = await supabaseClient
      .from('subscribers')
      .upsert({
        user_id: userId,
        email: session.customer_email || '',
        subscription_tier: packageType,
        subscribed: true,
        stripe_customer_id: session.customer as string,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Failed to update subscription after donation:', error)
      throw error
    }

    console.log(`Successfully processed app development donation for user ${userId}, tier: ${packageName}`)
  } else {
    console.log(`Checkout session completed for user ${userId} (regular claim donation, not app development donation)`)
  }
}