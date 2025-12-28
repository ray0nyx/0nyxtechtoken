// Follow this setup guide to integrate the Deno runtime and the Supabase JS library with your project:
// https://deno.land/manual/getting_started/setup_your_environment

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type RegisterUserRequest = {
  email: string;
  password: string;
  useAlternativeMethod?: boolean;
  emailProvider?: string;
}

console.log("Hello from register-user function! Version: 4.0")

// This function handles user registration when the normal flow fails
// due to database errors with the user creation trigger.
serve(async (req) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
  }

  try {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers
      })
    }

    console.log("Processing registration request...");

    // Parse the request body
    let requestData: RegisterUserRequest;
    try {
      requestData = await req.json() as RegisterUserRequest;
      console.log("Request parsed successfully");
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid request format" 
        }),
        { status: 400, headers }
      )
    }

    if (!requestData.email || !requestData.password) {
      console.error("Missing required fields:", { 
        email: !!requestData.email, 
        password: !!requestData.password 
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email and password are required" 
        }),
        { status: 400, headers }
      )
    }

    // Check if it's a ProtonMail address if not explicitly provided
    const isProtonMail = requestData.emailProvider === 'protonmail' || 
                         requestData.email.toLowerCase().includes('@proton.') || 
                         requestData.email.toLowerCase().includes('@pm.') || 
                         requestData.email.toLowerCase().includes('@protonmail.') ||
                         requestData.email.toLowerCase().includes('@proton.me');
    
    if (isProtonMail) {
      console.log("ProtonMail user detected, using special handling flow");
    }

    console.log(`Attempting to register user with email: ${requestData.email}`);

    // Get the API keys from environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

    if (!supabaseUrl) {
      console.error("Missing SUPABASE_URL environment variable");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Server configuration error: Missing URL" 
        }),
        { status: 500, headers }
      )
    }

    if (!supabaseServiceKey) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Server configuration error: Missing service key" 
        }),
        { status: 500, headers }
      )
    }

    console.log("Creating Supabase client...");
    
    // Create a Supabase client with the service role key
    // Important: This has admin privileges, so it should only be used in secure contexts
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create a regular client for fallback operations
    const regularClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey);

    // Generate a UUID for the user
    const userId = crypto.randomUUID();
    console.log(`Generated user ID: ${userId}`);

    // Step 1: Create the user record in public.users
    try {
      console.log("Creating user record in public.users table...");
      const { error: publicUserError } = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            email: requestData.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .single();

      if (publicUserError) {
        console.error("Error creating public user record:", publicUserError);
        // Continue anyway
      } else {
        console.log("Successfully created user record in public.users table");
      }
    } catch (userInsertError) {
      console.error("Exception creating public user:", userInsertError);
      // Continue anyway
    }

    // Step 2: Create a pending subscription (requires payment)
    try {
      console.log("Creating pending subscription record...");
      
      // Calculate dates (not used for trial, but kept for consistency)
      const trialStartDate = new Date();
      const trialEndDate = new Date(trialStartDate);
      trialEndDate.setDate(trialEndDate.getDate() + 7);
      
      const { error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .insert([
          {
            id: crypto.randomUUID(),
            user_id: userId,
            status: 'pending',  // Changed from 'trial' to 'pending'
            access_level: 'no_access',  // Changed from 'full_access' to 'no_access'
            email: requestData.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            trial_start_date: trialStartDate.toISOString(),
            trial_end_date: trialEndDate.toISOString(),
            current_period_start: trialStartDate.toISOString(),
            current_period_end: trialEndDate.toISOString()
          }
        ])
        .single();

      if (subscriptionError) {
        console.error("Error creating pending subscription:", subscriptionError);
        // Continue anyway
      } else {
        console.log("Successfully created pending subscription record");
      }
    } catch (subscriptionError) {
      console.error("Exception creating subscription:", subscriptionError);
      // Continue anyway
    }

    // Step 3: Create the user in auth.users
    try {
      console.log("Creating new user in auth system...");
      
      // Special handling for ProtonMail or forced alternative method
      if (isProtonMail || requestData.useAlternativeMethod) {
        console.log("Using admin API to create user (bypassing hooks)");
        const { data: userData, error: userError } = await supabase.auth.admin.createUser({
          email: requestData.email,
          password: requestData.password,
          email_confirm: true, // Auto-confirm email for better experience
          user_metadata: {
            has_subscription: true,
            email_provider: isProtonMail ? 'protonmail' : 'other',
            created_with_alternative_method: true
          }
        });

        if (userError) {
          console.error("Error creating user with admin API:", userError);
          throw userError;
        }

        if (!userData.user) {
          console.error("No user data returned from auth.admin.createUser");
          throw new Error("User created but no user data returned");
        }

        console.log(`Created new user with admin API, ID: ${userData.user.id}`);
        
        // Attempt to update the ID to match our pre-generated one
        try {
          if (userData.user.id !== userId) {
            console.log(`Aligning custom user ID: ${userId} with auth user ID: ${userData.user.id}`);
            
            // Update our custom users table to match auth ID
            const { error: updateError } = await supabase
              .from('users')
              .update({ id: userData.user.id })
              .eq('id', userId);
              
            if (updateError) {
              console.error("Error updating user ID:", updateError);
              // Continue anyway, as both users exist
            }
            
            // Update subscription to match auth ID
            const { error: subUpdateError } = await supabase
              .from('user_subscriptions')
              .update({ user_id: userData.user.id })
              .eq('user_id', userId);
              
            if (subUpdateError) {
              console.error("Error updating subscription user ID:", subUpdateError);
              // Continue anyway
            }
          }
        } catch (idAlignError) {
          console.error("Error aligning IDs:", idAlignError);
          // Continue anyway
        }
        
        console.log("User registration process completed successfully with admin API");
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              id: userData.user.id,
              email: requestData.email
            },
            method: 'admin'
          }),
          { status: 200, headers }
        );
      } else {
        // Standard approach for non-ProtonMail users
        console.log("Using regular signup flow");
        const { data: signupData, error: signupError } = await regularClient.auth.signUp({
          email: requestData.email,
          password: requestData.password,
          options: {
            data: {
              has_subscription: true
            }
          }
        });
        
        if (signupError) {
          console.error("Error with regular signup:", signupError);
          throw signupError;
        }
        
        if (!signupData.user) {
          console.error("No user data returned from regular signup");
          throw new Error("User created but no user data returned");
        }
        
        console.log(`Regular signup successful, user ID: ${signupData.user.id}`);
        
        // Update IDs if needed
        try {
          if (signupData.user.id !== userId) {
            console.log(`Aligning custom user ID: ${userId} with auth user ID: ${signupData.user.id}`);
            
            // Update our custom users table to match auth ID
            const { error: updateError } = await supabase
              .from('users')
              .update({ id: signupData.user.id })
              .eq('id', userId);
              
            if (updateError) {
              console.error("Error updating user ID:", updateError);
            }
            
            // Update subscription to match auth ID
            const { error: subUpdateError } = await supabase
              .from('user_subscriptions')
              .update({ user_id: signupData.user.id })
              .eq('user_id', userId);
              
            if (subUpdateError) {
              console.error("Error updating subscription user ID:", subUpdateError);
            }
          }
        } catch (idAlignError) {
          console.error("Error aligning IDs:", idAlignError);
          // Continue anyway
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              id: signupData.user.id,
              email: requestData.email
            },
            method: 'standard'
          }),
          { status: 200, headers }
        );
      }
    } catch (createError) {
      console.error("Exception creating user:", createError);
      
      // Last resort fallback - try admin API if it wasn't attempted yet
      if (!isProtonMail && !requestData.useAlternativeMethod) {
        console.log("Attempting last-resort admin API signup");
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.createUser({
            email: requestData.email,
            password: requestData.password,
            email_confirm: true,
            user_metadata: {
              has_subscription: true,
              created_with_fallback: true
            }
          });
          
          if (userError) {
            console.error("Error with fallback admin signup:", userError);
            throw userError;
          }
          
          if (!userData.user) {
            console.error("No user data returned from fallback admin signup");
            throw new Error("User created but no user data returned");
          }
          
          console.log(`Fallback admin signup successful, user ID: ${userData.user.id}`);
          
          // Align IDs
          try {
            if (userData.user.id !== userId) {
              const { error: updateError } = await supabase
                .from('users')
                .update({ id: userData.user.id })
                .eq('id', userId);
                
              if (updateError) {
                console.error("Error updating user ID in fallback:", updateError);
              }
              
              const { error: subUpdateError } = await supabase
                .from('user_subscriptions')
                .update({ user_id: userData.user.id })
                .eq('user_id', userId);
                
              if (subUpdateError) {
                console.error("Error updating subscription user ID in fallback:", subUpdateError);
              }
            }
          } catch (fallbackIdError) {
            console.error("Error aligning IDs in fallback:", fallbackIdError);
          }
          
          return new Response(
            JSON.stringify({
              success: true,
              user: {
                id: userData.user.id,
                email: requestData.email
              },
              method: 'fallback_admin'
            }),
            { status: 200, headers }
          );
        } catch (fallbackError) {
          console.error("Final fallback admin signup failed:", fallbackError);
          // Fall through to the error response
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Error creating user", 
          details: createError instanceof Error ? createError.message : String(createError)
        }),
        { status: 500, headers }
      )
    }
  } catch (error) {
    console.error("Global error in register-user function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Server error", 
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers
      }
    )
  }
}) 