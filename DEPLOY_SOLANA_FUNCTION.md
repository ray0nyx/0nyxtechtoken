# Deploy Solana Wallet Analytics Edge Function

The CORS error you're seeing means the Edge Function isn't deployed yet. Here's how to deploy it:

## Option 1: Deploy via Supabase Dashboard (Easiest)

1. Go to your Supabase Dashboard: https://app.supabase.com/project/nlctxawkutljeimvjacp
2. Click **"Edge Functions"** in the left sidebar
3. Click **"Create a new function"**
4. Name it: `solana-wallet-analytics`
5. Copy and paste the entire contents of `supabase/functions/solana-wallet-analytics/index.ts`
6. Click **"Deploy"**

## Option 2: Deploy via Supabase CLI

If you have the Supabase CLI installed:

```bash
# Install Supabase CLI if you don't have it
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (replace with your project ref)
supabase link --project-ref nlctxawkutljeimvjacp

# Deploy the function
supabase functions deploy solana-wallet-analytics --project-ref nlctxawkutljeimvjacp
```

## Option 3: Use Supabase Dashboard SQL Editor (Alternative)

If deployment fails, you can also create a simpler version that uses Supabase RPC functions instead of Edge Functions. But the Edge Function approach is better for performance.

## After Deployment

Once deployed, the function will be available at:
`https://nlctxawkutljeimvjacp.supabase.co/functions/v1/solana-wallet-analytics`

The CORS error should be resolved once the function is deployed and responding to OPTIONS requests correctly.


