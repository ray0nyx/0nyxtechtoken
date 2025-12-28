# JWT_SECRET Setup

## Local Environment

Add your JWT_SECRET to `.env.local`:

```bash
# JWT Secret for SIWS authentication (get this from your Vercel environment)
JWT_SECRET=your-actual-jwt-secret-from-vercel
```

## Supabase Edge Functions

The JWT_SECRET is used in the `siws-verify` edge function. Make sure to add it to your Supabase project:

1. Go to Supabase Dashboard → Project Settings → Edge Functions
2. Add environment variable: `JWT_SECRET`
3. Set the value to match your Vercel environment variable

## Security Notes

- Never commit JWT_SECRET to version control
- Use a strong, random secret (at least 32 characters)
- Use different secrets for development and production
- Rotate secrets periodically
