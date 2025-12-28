#!/bin/bash

# Stripe Webhook Setup Script
echo "🚀 Setting up Stripe Webhook for Affiliate Commission System"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if user is logged in to Supabase
if ! supabase status &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please run:"
    echo "   supabase login"
    exit 1
fi

echo "✅ Supabase CLI is ready"

# Deploy the webhook functions
echo "📦 Deploying Stripe webhook functions..."

# Deploy main webhook function
supabase functions deploy stripe-webhook

# Deploy test webhook function
supabase functions deploy test-stripe-webhook

echo "✅ Webhook functions deployed successfully"

# Get the project URL
PROJECT_URL=$(supabase status | grep "API URL" | awk '{print $3}')
echo "🌐 Project URL: $PROJECT_URL"

# Display webhook URLs
echo ""
echo "🔗 Webhook URLs:"
echo "   Main Webhook: $PROJECT_URL/functions/v1/stripe-webhook"
echo "   Test Webhook: $PROJECT_URL/functions/v1/test-stripe-webhook"
echo ""

# Display environment variables needed
echo "🔧 Environment Variables needed:"
echo "   STRIPE_SECRET_KEY=sk_test_..."
echo "   STRIPE_WEBHOOK_SECRET=whsec_..."
echo ""

# Display Stripe webhook configuration instructions
echo "📋 Next Steps:"
echo "1. Go to your Stripe Dashboard → Developers → Webhooks"
echo "2. Click 'Add endpoint'"
echo "3. Set URL to: $PROJECT_URL/functions/v1/stripe-webhook"
echo "4. Select these events:"
echo "   - customer.subscription.created"
echo "   - customer.subscription.updated"
echo "   - customer.subscription.deleted"
echo "   - invoice.payment_succeeded"
echo "   - invoice.payment_failed"
echo "   - payment_intent.succeeded"
echo "   - checkout.session.completed"
echo "5. Copy the webhook secret and set it as STRIPE_WEBHOOK_SECRET"
echo "6. Set your Stripe secret key as STRIPE_SECRET_KEY"
echo ""

# Test the webhook
echo "🧪 Testing webhook..."
echo "You can test with:"
echo "curl -X POST $PROJECT_URL/functions/v1/test-stripe-webhook \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"event_type\": \"subscription\", \"customer_id\": \"cus_test\", \"amount\": 29.99, \"subscription_id\": \"sub_test\", \"invoice_id\": \"in_test\"}'"
echo ""

echo "✅ Stripe webhook setup complete!"
echo "📖 See docs/STRIPE_WEBHOOK_SETUP.md for detailed documentation"
