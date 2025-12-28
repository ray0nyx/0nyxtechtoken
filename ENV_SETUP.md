# Environment Variables Setup

## Local Development (.env.local)

Add the following to your `.env.local` file:

```bash
# Supabase Configuration (already configured)
VITE_SUPABASE_URL=https://nlctxawkutljeimvjacp.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# JWT Secret for SIWS authentication
# Get this value from your Vercel environment variables
JWT_SECRET=your-actual-jwt-secret-from-vercel
```

## Supabase Edge Functions

The `JWT_SECRET` is required for the `siws-verify` edge function.

### To add JWT_SECRET to Supabase:

1. Go to your Supabase Dashboard
2. Navigate to: **Project Settings** → **Edge Functions** → **Secrets**
3. Click **Add Secret**
4. Name: `JWT_SECRET`
5. Value: (same value as in your Vercel environment)
6. Click **Save**

### Alternative: Using Supabase CLI

```bash
supabase secrets set JWT_SECRET=your-actual-jwt-secret-from-vercel
```

## Vercel Environment

Make sure `JWT_SECRET` is set in your Vercel project:
- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Ensure `JWT_SECRET` is set for all environments (Production, Preview, Development)

## Security Notes

- **Never commit** `.env.local` or actual secrets to version control
- Use different secrets for development and production
- Rotate secrets periodically
- Use a strong, random secret (at least 32 characters)
