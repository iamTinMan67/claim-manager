import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-COLLABORATOR-NOTIFICATION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const { claimId, collaboratorCount, donationAmount } = body;

    if (!claimId || !collaboratorCount || !donationAmount) {
      throw new Error("Missing required parameters");
    }

    logStep("Parameters validated", { claimId, collaboratorCount, donationAmount });

    // Get claim owner email
    const { data: ownerEmail, error: emailError } = await supabaseClient
      .rpc('get_claim_owner_email', { claim_id_param: claimId });

    if (emailError || !ownerEmail) {
      throw new Error(`Failed to get owner email: ${emailError?.message}`);
    }

    logStep("Owner email retrieved", { ownerEmail });

    // Create payment link (this will be handled by the frontend)
    const paymentUrl = `${req.headers.get("origin")}/donation-payment?claimId=${claimId}&amount=${donationAmount}`;

    const resend = new Resend(resendKey);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Collaborator Limit Reached</h2>
        <p>Your claim has reached the ${collaboratorCount > 100 ? '100' : '50'} collaborator limit.</p>
        <p>To add more collaborators, a donation of <strong>£${donationAmount / 100}</strong> is required.</p>
        <div style="margin: 30px 0;">
          <a href="${paymentUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Make Donation Payment
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          This donation helps support the infrastructure needed for larger collaboration groups.
        </p>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "Claims Collaboration <onboarding@resend.dev>",
      to: [ownerEmail],
      subject: `Collaborator Limit Reached - Donation Required (£${donationAmount / 100})`,
      html: emailHtml,
    });

    logStep("Email sent successfully", emailResponse);

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});