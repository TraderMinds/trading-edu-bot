# Test script for API token
Write-Host "🔍 Testing API Token for GitHub Actions Compatibility" -ForegroundColor Cyan

# You'll need to set this manually with your new token
$ApiToken = Read-Host "Enter your new API Token"

if (-not $ApiToken) {
    Write-Host "❌ No token provided" -ForegroundColor Red
    exit 1
}

# Set environment variables
$env:CLOUDFLARE_API_TOKEN = $ApiToken
$env:CLOUDFLARE_ACCOUNT_ID = "f926e63933e4c6bf7eb3eb502955dfc7"

Write-Host "Testing authentication with API token..." -ForegroundColor Yellow
npx wrangler whoami

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ API Token authentication successful" -ForegroundColor Green
    
    Write-Host "Testing deployment..." -ForegroundColor Yellow
    npx wrangler deploy --dry-run --env=""
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Deployment test successful" -ForegroundColor Green
        Write-Host "🎉 This token should work in GitHub Actions!" -ForegroundColor Green
        Write-Host "📝 Update your GitHub secret CF_API_TOKEN with this token" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Deployment test failed" -ForegroundColor Red
    }
} else {
    Write-Host "❌ API Token authentication failed" -ForegroundColor Red
}

# Clear the token from memory
$env:CLOUDFLARE_API_TOKEN = $null