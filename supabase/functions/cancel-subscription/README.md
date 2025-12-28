# Cancel Subscription Edge Function

This Supabase Edge Function handles cancellation of a user's Stripe subscription.

## Purpose

This function allows users to cancel their current subscription plan. The subscription is not immediately terminated but is set to cancel at the end of the current billing period, allowing users to retain access to premium features until their paid period ends.

## Authentication

This function requires authentication. The requesting user must have an active subscription to cancel.

## Request Format

```json
{
  "userId": "user_id_here" // Optional, if not provided, uses the authenticated user's ID
}
```

## Response Format

Success:
```json
{
  "success": true,
  "message": "Subscription will be canceled at the end of the current billing period"
}
```

Error:
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

## Error Codes

- 400: Bad request (malformed request body, Stripe API error)
- 401: Unauthorized (invalid or missing authentication)
- 404: Not found (no active subscription found for the user)
- 500: Server error (database error, missing environment variables)

## Environment Variables Required

- `SUPABASE_URL`: The URL of your Supabase project
- `SUPABASE_ANON_KEY`: The anon key for your Supabase project
- `SUPABASE_SERVICE_ROLE_KEY`: The service role key for database operations
- `STRIPE_SECRET_KEY`: Your Stripe secret key

## Database Schema

Requires a `subscriptions` table with at least the following columns:
- `id`: The subscription ID in your database
- `user_id`: The ID of the user who owns the subscription
- `stripe_subscription_id`: The ID of the subscription in Stripe
- `status`: The current status of the subscription (should be 'active' for cancellable subscriptions)
- `cancel_at_period_end`: Boolean indicating if the subscription is set to cancel at the end of the current period
- `updated_at`: Timestamp for when the subscription was last updated 