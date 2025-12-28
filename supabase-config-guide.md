# Supabase Configuration for Password Reset

## Current Issue
The password reset emails are still redirecting to the old Vercel URL instead of the production domain.

## Required Supabase Configuration

### 1. Go to Supabase Dashboard
- Visit: https://supabase.com/dashboard
- Select your project: `nlctxawkutljeimvjacp`

### 2. Authentication Settings
- Go to: **Authentication** → **URL Configuration**

### 3. Update Site URL
- **Site URL**: `https://wagyutech.app`

### 4. Update Redirect URLs
Add these URLs to the **Redirect URLs** list:
- `https://wagyutech.app/reset-password`
- `https://wagyutech.app/auth/callback`
- `https://wagyutech.app/`

### 5. Remove Old URLs
Remove these old URLs if they exist:
- `https://wagyu-orcin.vercel.app/*`
- `https://wagyu-ncc44079l-raynayams-projects.vercel.app/*`
- Any other Vercel deployment URLs

## Expected Email Link Format
After configuration, password reset emails should contain:
```
https://nlctxawkutljeimvjacp.supabase.co/auth/v1/verify?token=TOKEN&type=recovery&redirect_to=https://wagyutech.app/reset-password
```

## Testing
1. Go to `https://wagyutech.app/signin`
2. Click "Forgot Password"
3. Enter email and submit
4. Check email for reset link
5. Click link - should go to `https://wagyutech.app/reset-password`

## Fallback Solution
If the Supabase settings can't be updated immediately, the `RecoveryInterceptor` component will catch any recovery links and redirect them to the correct handler.
