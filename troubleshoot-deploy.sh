#!/bin/bash

echo "🔍 Cloudflare Workers Deployment Troubleshooting Script"
echo "========================================================"

# Check if required environment variables are set
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ CLOUDFLARE_API_TOKEN is not set"
    echo "💡 Set it with: export CLOUDFLARE_API_TOKEN=your_token_here"
    exit 1
fi

if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo "❌ CLOUDFLARE_ACCOUNT_ID is not set"
    echo "💡 Set it with: export CLOUDFLARE_ACCOUNT_ID=your_account_id_here"
    exit 1
fi

echo "✅ Environment variables are set"

# Test Wrangler authentication
echo ""
echo "🔐 Testing Wrangler Authentication..."
npx wrangler whoami

if [ $? -ne 0 ]; then
    echo "❌ Authentication failed!"
    echo "💡 Check your CLOUDFLARE_API_TOKEN permissions:"
    echo "   - Account: Cloudflare Workers:Edit"
    echo "   - Zone: Zone:Read, Zone:Edit (for custom domains)"
    echo "   - Account Resources: Include All accounts"
    exit 1
fi

echo "✅ Authentication successful"

# Check account details
echo ""
echo "📊 Checking Account Details..."
npx wrangler kv:namespace list 2>/dev/null || echo "⚠️  Could not list KV namespaces (this might be normal)"

# Test dry run deployment
echo ""
echo "🧪 Testing Dry Run Deployment..."
npx wrangler deploy --dry-run --env=""

if [ $? -ne 0 ]; then
    echo "❌ Dry run failed!"
    echo "💡 This indicates a configuration issue"
    exit 1
fi

echo "✅ Dry run successful"

# Attempt actual deployment
echo ""
echo "🚀 Attempting Actual Deployment..."
npx wrangler deploy --env=""

if [ $? -eq 0 ]; then
    echo "🎉 Deployment successful!"
else
    echo "❌ Deployment failed!"
    echo ""
    echo "🔧 Possible solutions:"
    echo "1. Check your Cloudflare account billing status"
    echo "2. Verify your Workers plan allows deployments"
    echo "3. Regenerate your API token with proper permissions"
    echo "4. Contact Cloudflare support about error code 10014"
    echo "5. Check if there's a service disruption: https://www.cloudflarestatus.com/"
fi