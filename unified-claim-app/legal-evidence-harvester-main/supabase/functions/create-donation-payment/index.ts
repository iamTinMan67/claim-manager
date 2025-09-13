import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper logging function for enhanced debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-DONATION-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use the service role key to perform writes in Supabase
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const body = await req.json();
    const { claimId, shareId, customAmount } = body;
    
    if (!claimId || !shareId) {
      throw new Error("Missing required parameters: claimId and shareId");
    }
    logStep("Request parameters validated", { claimId, shareId });

    // Verify user owns the claim and the share exists
    const { data: shareData, error: shareError } = await supabaseClient
      .from("claim_shares")
      .select("*, claims!inner(*)")
      .eq("id", shareId)
      .eq("claim_id", claimId)
      .eq("claims.user_id", user.id)
      .single();

    if (shareError || !shareData) {
      throw new Error("Share not found or unauthorized");
    }
    logStep("Share verified", { shareId: shareData.id });

    // Use custom amount if provided, otherwise calculate donation amount
    let donationAmount = customAmount;
    if (!donationAmount) {
      const { data: calculatedAmount, error: donationError } = await supabaseClient
        .rpc('calculate_donation_amount', { claim_id_param: claimId });
      
      if (donationError) {
        throw new Error(`Error calculating donation amount: ${donationError.message}`);
      }
      donationAmount = calculatedAmount;
    }
    
    logStep("Donation amount determined", { donationAmount, customAmount });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
    } else {
      logStep("No existing customer found");
    }

    // Create one-time payment session with calculated donation amount
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { 
              name: "Collaboration Donation",
              description: "Support additional claim collaborator"
            },
            unit_amount: donationAmount, // Dynamic amount in pence
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        claimId: claimId,
        shareId: shareId,
        userId: user.id,
      },
      success_url: `${req.headers.get("origin")}/donation-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/`,
    });

    logStep("Stripe session created", { sessionId: session.id });

    // Update the share with payment intent information
    await supabaseClient
      .from("claim_shares")
      .update({
        stripe_payment_intent_id: session.id,
        donation_amount: donationAmount,
      })
      .eq("id", shareId);

    logStep("Share updated with payment info");

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-donation-payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});