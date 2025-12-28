# SMTP Setup for Support Emails

To enable the support email feature, you need to set up SMTP credentials in your Supabase project.

## Required Environment Variables

The following environment variables have already been set:
- `SMTP_HOSTNAME`: smtp.gmail.com
- `SMTP_PORT`: 587
- `SMTP_FROM`: ramirezrayba@gmail.com

You still need to set up the following sensitive credentials:

```bash
supabase secrets set SMTP_USERNAME=your-email@gmail.com SMTP_PASSWORD=your-app-password
```

## Using Gmail

If you're using Gmail, you'll need to:

1. Enable 2-Factor Authentication on your Google account
2. Generate an "App Password" specifically for this application
   - Go to your Google Account settings → Security → App passwords
   - Select "Other" from the dropdown, give it a name like "WagYu Support"
   - Use the generated 16-character password as your SMTP_PASSWORD

## Testing

You can test if your SMTP setup is working by:

1. Opening the Settings page in the application
2. Going to the Profile tab
3. Clicking "Contact Support"
4. Filling out the form and submitting it

The email should be sent to rayhan@arafatcapital.com. 