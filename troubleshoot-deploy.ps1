# Cloudflare Workers Deployment Troubleshooting Script (PowerShell)
Write-Host "🔍 Cloudflare Workers Deployment Troubleshooting Script" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Check if required environment variables are set
if (-not $env:CLOUDFLARE_API_TOKEN) {
    Write-Host "❌ CLOUDFLARE_API_TOKEN is not set" -ForegroundColor Red
    Write-Host "💡 Set it with: `$env:CLOUDFLARE_API_TOKEN='your_token_here'" -ForegroundColor Yellow
    exit 1
}

if (-not $env:CLOUDFLARE_ACCOUNT_ID) {
    Write-Host "❌ CLOUDFLARE_ACCOUNT_ID is not set" -ForegroundColor Red
    Write-Host "💡 Set it with: `$env:CLOUDFLARE_ACCOUNT_ID='your_account_id_here'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Environment variables are set" -ForegroundColor Green

# Test Wrangler authentication
Write-Host ""
Write-Host "🔐 Testing Wrangler Authentication..." -ForegroundColor Yellow
npx wrangler whoami

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Authentication failed!" -ForegroundColor Red
    Write-Host "💡 Check your CLOUDFLARE_API_TOKEN permissions:" -ForegroundColor Yellow
    Write-Host "   - Account: Cloudflare Workers:Edit" -ForegroundColor White
    Write-Host "   - Zone: Zone:Read, Zone:Edit (for custom domains)" -ForegroundColor White
    Write-Host "   - Account Resources: Include All accounts" -ForegroundColor White
    exit 1
}

Write-Host "✅ Authentication successful" -ForegroundColor Green

# Check account details
Write-Host ""
Write-Host "📊 Checking Account Details..." -ForegroundColor Yellow
npx wrangler kv:namespace list 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Could not list KV namespaces (this might be normal)" -ForegroundColor Yellow
}

# Test dry run deployment
Write-Host ""
Write-Host "🧪 Testing Dry Run Deployment..." -ForegroundColor Yellow
npx wrangler deploy --dry-run --env=""

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Dry run failed!" -ForegroundColor Red
    Write-Host "💡 This indicates a configuration issue" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Dry run successful" -ForegroundColor Green

# Attempt actual deployment
Write-Host ""
Write-Host "🚀 Attempting Actual Deployment..." -ForegroundColor Yellow
npx wrangler deploy --env=""

if ($LASTEXITCODE -eq 0) {
    Write-Host "🎉 Deployment successful!" -ForegroundColor Green
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Possible solutions:" -ForegroundColor Yellow
    Write-Host "1. Check your Cloudflare account billing status" -ForegroundColor White
    Write-Host "2. Verify your Workers plan allows deployments" -ForegroundColor White
    Write-Host "3. Regenerate your API token with proper permissions" -ForegroundColor White
    Write-Host "4. Contact Cloudflare support about error code 10014" -ForegroundColor White
    Write-Host "5. Check if there's a service disruption: https://www.cloudflarestatus.com/" -ForegroundColor White
}