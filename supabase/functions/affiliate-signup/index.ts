import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { 
      firstName,
      lastName,
      email,
      password,
      country,
      website,
      companyName,
      instagramUrl,
      facebookUrl,
      youtubeUrl,
      twitterUrl,
      linkedinUrl,
      twitchUrl,
      tiktokUrl,
      promotionPlan,
      additionalInfo,
      emailAgreement,
      termsAgreement
    } = await req.json()

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !website || !promotionPlan || !emailAgreement || !termsAgreement) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user with this email already exists
    const { data: existingApplication, error: userCheckError } = await supabaseClient
      .from('affiliate_applications')
      .select('id, status')
      .eq('email', email)
      .single()

    if (userCheckError && userCheckError.code !== 'PGRST116') {
      console.error('Error checking for existing application:', userCheckError)
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (existingApplication) {
      if (existingApplication.status === 'pending') {
        return new Response(
          JSON.stringify({ error: 'You have already submitted an affiliate application that is currently pending review.' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      } else if (existingApplication.status === 'approved') {
        return new Response(
          JSON.stringify({ error: 'You are already an approved affiliate. Please contact support if you need assistance.' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      } else if (existingApplication.status === 'denied') {
        return new Response(
          JSON.stringify({ error: 'Your previous affiliate application was denied. Please contact support if you believe this was an error.' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Insert new affiliate application
    const { data, error } = await supabaseClient
      .from('affiliate_applications')
      .insert([
        {
          first_name: firstName,
          last_name: lastName,
          email,
          password, // Note: In production, this should be hashed
          country,
          website,
          company_name: companyName,
          instagram_url: instagramUrl,
          facebook_url: facebookUrl,
          youtube_url: youtubeUrl,
          twitter_url: twitterUrl,
          linkedin_url: linkedinUrl,
          twitch_url: twitchUrl,
          tiktok_url: tiktokUrl,
          promotion_plan: promotionPlan,
          additional_info: additionalInfo,
          email_agreement: emailAgreement,
          terms_agreement: termsAgreement,
          status: 'pending'
        }
      ])
      .select()

    if (error) {
      console.error('Error inserting new affiliate application:', error)
      return new Response(
        JSON.stringify({ error: 'Error submitting application' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Return success
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Application submitted successfully',
        applicationId: data[0].id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
