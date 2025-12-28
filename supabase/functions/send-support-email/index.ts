import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

interface RequestBody {
  from: string;
  fromName: string;
  subject: string;
  message: string;
  to: string;
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { from, fromName, subject, message, to } = await req.json() as RequestBody;

    // Validate required fields
    if (!from || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Ensure the destination is the fixed support email to prevent abuse
    const supportEmail = "rayhan@arafatcapital.com";
    if (to !== supportEmail) {
      console.warn("Attempted to send to unauthorized recipient:", to);
      // Still proceed but override the recipient
    }

    // Configure SMTP client
    const client = new SmtpClient();

    // Connect to SMTP server using environment variables
    await client.connectTLS({
      hostname: Deno.env.get("SMTP_HOSTNAME") || "",
      port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
      username: Deno.env.get("SMTP_USERNAME") || "",
      password: Deno.env.get("SMTP_PASSWORD") || "",
    });

    // Send email
    await client.send({
      from: Deno.env.get("SMTP_FROM") || "support@wagyu.app",
      to: supportEmail,
      replyTo: from,
      subject: `Support Request: ${subject}`,
      content: `
From: ${fromName} (${from})
Subject: ${subject}

Message:
${message}
      `,
      html: `
<p><strong>From:</strong> ${fromName} (${from})</p>
<p><strong>Subject:</strong> ${subject}</p>
<h3>Message:</h3>
<p>${message.replace(/\n/g, '<br>')}</p>
      `,
    });

    // Close connection
    await client.close();

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error handling support request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send support request" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}); 