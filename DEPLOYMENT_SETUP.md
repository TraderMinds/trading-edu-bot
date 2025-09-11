# GitHub Actions Deployment Setup

## Current Status
✅ **Tests**: All passing (6/6)  
✅ **Linting**: Clean (0 errors)  
✅ **Local Deployment**: Working  
❌ **GitHub Actions**: Missing Cloudflare API Token  

## Required GitHub Secrets

To enable automated deployment via GitHub Actions, you need to add two secrets to your repository:

### 1. Get Cloudflare API Token

1. **Visit Cloudflare Dashboard**: Go to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)

2. **Create Token**: Click "Create Token"

3. **Use Template**: Select "Cloudflare Workers:Edit" template or create custom token with these permissions:
   - **Zone:Zone:Read** (All zones)
   - **User:User:Read** 
   - **Account:Cloudflare Workers:Edit** (Your account)

4. **Account Resources**: Select your specific account

5. **Generate Token**: Click "Continue to summary" → "Create Token"

6. **Copy Token**: Save the token securely (it won't be shown again)

### 2. Get Account ID

1. **Visit Workers Dashboard**: Go to [workers.cloudflare.com](https://workers.cloudflare.com/)
2. **Copy Account ID**: Find it in the right sidebar under "Account details"

### 3. Add Secrets to GitHub

1. **Go to Repository**: Navigate to `https://github.com/TraderMinds/trading-edu-bot`

2. **Open Settings**: Click **Settings** tab

3. **Navigate to Secrets**: Click **Secrets and variables** → **Actions**

4. **Add First Secret**:
   - Click **New repository secret**
   - **Name**: `CF_API_TOKEN`
   - **Value**: Paste your Cloudflare API token
   - Click **Add secret**

5. **Add Second Secret**:
   - Click **New repository secret**
   - **Name**: `CF_ACCOUNT_ID`
   - **Value**: Paste your Account ID
   - Click **Add secret**

## Verification

Once you add the secrets:

1. **Manual Test**: Go to **Actions** tab → **Deploy to Cloudflare Workers** → **Run workflow**

2. **Automatic**: Push any change to the `main` branch to trigger deployment

## Current GitHub Actions Configuration

The workflow is already properly configured in `.github/workflows/deploy.yml`:

```yaml
- name: Deploy to Cloudflare Workers
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CF_API_TOKEN }}
    accountId: ${{ secrets.CF_ACCOUNT_ID }}
    command: deploy
```

## Enhanced Features Deployed

✅ **Minute-Level Scheduling**: 5, 10, 15, 20, 30-minute options  
✅ **Schedule Management API**: GET/POST endpoints with validation  
✅ **Real-Time UI Updates**: Next post calculation  
✅ **Persistent Storage**: Schedule saved to KV storage  
✅ **Enhanced Model Management**: 8 AI models with per-post selection  

## Need Help?

If you encounter issues:
1. Verify the API token has the correct permissions
2. Ensure the Account ID matches your Cloudflare account
3. Check that secrets are named exactly: `CF_API_TOKEN` and `CF_ACCOUNT_ID`
4. Test locally first with `npm run deploy`