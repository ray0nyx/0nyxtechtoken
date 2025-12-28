# Send Support Email

This Supabase Edge Function handles support requests from users and sends emails to the support team.

## Purpose

This function provides a secure way for users to contact support directly from the application. It:

1. Validates the incoming request
2. Ensures emails are only sent to the designated support email address
3. Uses SMTP to send formatted emails with user information and their message

## Required Environment Variables

To use this function, you need to set the following environment variables in your Supabase project:

- `SMTP_HOSTNAME`: The SMTP server hostname (e.g., "smtp.gmail.com")
- `SMTP_PORT`: The SMTP server port (e.g., "587")
- `SMTP_USERNAME`: The SMTP account username/email
- `SMTP_PASSWORD`: The SMTP account password or app-specific password
- `SMTP_FROM`: The sender email address (e.g., "support@wagyu.app")

You can set these environment variables using the Supabase dashboard or CLI:

```bash
supabase secrets set SMTP_HOSTNAME=your-smtp-hostname
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USERNAME=your-smtp-username
supabase secrets set SMTP_PASSWORD=your-smtp-password
supabase secrets set SMTP_FROM=your-from-email
```

## Local Development

For local development, you can use the `.env` file in the root of the project and add these environment variables.

## Deployment

Deploy the function to Supabase:

```bash
supabase functions deploy send-support-email
```

## Usage

The function accepts POST requests with the following JSON body:

```json
{
  "from": "user@example.com",
  "fromName": "User Name",
  "subject": "Support Request Subject",
  "message": "The details of the user's issue...",
  "to": "rayhan@arafatcapital.com"
}
```

The function will always send emails to the hardcoded support address, regardless of the "to" field in the request (for security). 