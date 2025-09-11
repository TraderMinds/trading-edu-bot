# Trading Education Bot (Cloudflare Worker)

Automated trading education delivery to Telegram with flexible cron scheduling and a simple web admin UI. Runs on Cloudflare Workers with KV storage.

Badges
- Deploy Status: see .github/workflows/deploy.yml in your repo
- Tests: 6/6 passing (see tests folder)

Features
- Content
  - AI posts via OpenRouter (optional; falls back to templates)
  - Subject queue managed in the UI
  - Optional branded footer
- Scheduling
  - Minute-level cron schedules (2/5/10 minutes, hourly, etc.)
  - Web UI shows “deployment required” when cron changed
  - Helper script keeps wrangler.toml and env vars in sync
- Platform
  - Cloudflare Worker + KV for state
  - GitHub Actions CI (tests + deploy)
  - Jest + ESLint

Quick Start
1) Clone & install
   - git clone <your repo>
   - cd <repo>
   - npm install
2) Configure secrets (Worker or GitHub repo secrets)
   - Required: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ADMIN_TOKEN
   - Optional: OPENROUTER_API_KEY, CF_API_TOKEN, CF_ACCOUNT_ID
3) Run / Deploy
   - Local dev: npm run start
   - Deploy: npm run deploy
   - Tests: npm test

Schedule Management
- Apply a new cron and keep env vars in sync, then deploy
  - Every 5 minutes: npm run update-schedule "*/5 * * * *"
  - Every 2 hours: npm run update-schedule "0 */2 * * *"
  - Daily 9 AM: npm run update-schedule "0 9 * * *"
  - Then: npm run deploy
- Note: Cloudflare only applies cron changes on deploy. The UI helps pick a schedule and indicates if redeploy is required.

Admin UI
- Visit your Worker URL and authenticate with ADMIN_TOKEN
- You can:
  - View stats and next scheduled post
  - Manage queue and footer
  - Change schedule (requires deploy to apply)
  - Trigger a manual post

Architecture
- GitHub Actions → Cloudflare Worker → Telegram API
- KV: queue, settings, stats

Project structure
- src/
  - index.js (Worker: cron + API + UI)
  - auth.js (admin token auth)
  - assets/ui (UI HTML/JS)
- scripts/update-schedule.js
- .github/workflows/deploy.yml
- wrangler.toml

Troubleshooting
- Schedule changed in UI but not applied: run update-schedule and deploy
  - npm run update-schedule "*/5 * * * *"
  - npm run deploy
- GitHub Actions auth fails: set CF_API_TOKEN (Workers:Edit) and CF_ACCOUNT_ID
- Posts not sending: verify TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
- No AI output: add OPENROUTER_API_KEY or rely on templates

Contributing
- PRs welcome. Please run npm test and npm run lint before submitting.

License
- MIT