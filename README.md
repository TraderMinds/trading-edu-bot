# Trading Educational Telegram Bot (Cloudflare Worker)

This repository contains a Cloudflare Worker that posts an educational trading tip (crypto/forex) with an image to a Telegram group every hour.

Summary
- Uses an AI text generator (OpenRouter) when you provide an API key; otherwise uses a small built-in template fallback.
- Uses Unsplash Source to fetch a free relevant image.
- Runs as a Cloudflare Worker with a cron trigger (hourly).
- Deploys automatically from GitHub to Cloudflare Workers using GitHub Actions on push to `main`.

Requirements and secrets
- GitHub repository with this code pushed to `main` branch.
- GitHub Secrets (Repository Settings → Secrets):
  - `CF_API_TOKEN` — Cloudflare API Token with Workers:Edit and Workers:Write permissions.
  - `CF_ACCOUNT_ID` — Your Cloudflare account ID.
  - `TELEGRAM_BOT_TOKEN` — Your Telegram bot token (from BotFather).
  - `TELEGRAM_CHAT_ID` — Target chat id (for groups it's usually negative; you can get it by adding the bot and using `getUpdates` or other methods).
  - `OPENROUTER_API_KEY` — (optional) OpenRouter API key if you want AI-generated text. If not provided the worker will use a fallback template.

How it works (high level)
1. Cloudflare Worker runs a scheduled trigger every hour.
2. Worker generates a short educational post using OpenRouter (if key provided) or fallback.
3. Worker requests a relevant free image from Unsplash Source.
4. Worker posts the image + caption to the Telegram group using the Bot API `sendPhoto` endpoint.

Files of interest
- `wrangler.toml` — Cloudflare Workers config and cron trigger.
- `src/index.js` — Worker code (scheduled + fetch handlers).
- `.github/workflows/deploy.yml` — GitHub Actions workflow to publish to Cloudflare Workers on push.

Assumptions & Notes
- This implementation uses Unsplash Source for images (free hotlinking) for reliability and zero keys. If you prefer AI image generation via OpenRouter or another service, update `src/index.js` accordingly and provide the API key as a secret.
- OpenRouter endpoint details may change; if you provide a key and the OpenRouter API shape is different, you may need to tune the request body/response parsing.

Next steps after pushing to GitHub
1. Add the required repository secrets listed above.
2. Push to `main` (GitHub Actions will deploy the Worker).
3. In Cloudflare dashboard, confirm the Worker is deployed and the cron trigger is registered.

Troubleshooting
- If posts aren't appearing, check GitHub Actions logs for deployment errors and Cloudflare Worker logs (Workers → your worker → Logs) for runtime errors. The worker logs will show HTTP responses when calling OpenRouter/Telegram.

License: MIT
