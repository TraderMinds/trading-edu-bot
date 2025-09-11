# 🤖 Trading Education Bot — Cloudflare Worker

[![Deploy Status](https://github.com/TraderMinds/trading-edu-bot/actions/workflows/deploy.yml/badge.svg)](https://github.com/TraderMinds/trading-edu-bot/actions)
[![Tests](https://img.shields.io/badge/tests-6%2F6%20passing-brightgreen)](./tests/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Automated trading education delivery with AI content, flexible cron scheduling, and a simple web admin UI. Runs serverlessly on Cloudflare Workers.

---

## 🚀 Features

### 📚 Content
- AI-generated posts via OpenRouter (optional; falls back to templates)
- Subject queue you can manage in the UI
- Optional branded footer (channel, site, company)

### ⏰ Scheduling
- Minute-level cron schedules (e.g., every 2/5/10 minutes, hourly, etc.)
- Web UI to pick a schedule, with clear “deployment required” status
- Helper script to update `wrangler.toml` automatically

### 🧰 Platform
- Cloudflare Worker + KV for persistent state
- GitHub Actions CI (tests + deploy)
- Jest tests and ESLint config

---

## 📋 Quick Start

### 1) Clone & Install
```bash
git clone https://github.com/TraderMinds/trading-edu-bot.git
cd trading-edu-bot
npm install
```

### 2) Configure Secrets
Provide these as Worker secrets or GitHub repo secrets:

Required
- `TELEGRAM_BOT_TOKEN` — Create with @BotFather
- `TELEGRAM_CHAT_ID` — Target chat/channel ID
- `ADMIN_TOKEN` — Token to access the admin UI

Optional
- `OPENROUTER_API_KEY` — Enables AI content
- `CF_API_TOKEN`, `CF_ACCOUNT_ID` — For GitHub Actions deploys

### 3) Run / Deploy
```bash
# Local dev
npm run start

# Deploy to Cloudflare
npm run deploy

# Tests
npm test
```

---

## 🎯 Schedule Management

Update the Worker’s cron trigger and keep env variables in sync:

```bash
# Every 5 minutes
npm run update-schedule "*/5 * * * *"

# Every 2 hours
npm run update-schedule "0 */2 * * *"

# Daily at 9 AM
npm run update-schedule "0 9 * * *"

# Then deploy
npm run deploy
```

The UI lets you pick a schedule and shows whether a redeploy is needed. Cloudflare only applies cron changes on deploy.

Available examples
- `* * * * *` — Every minute (testing)
- `*/5 * * * *` — Every 5 minutes
- `*/10 * * * *` — Every 10 minutes
- `0 * * * *` — Hourly
- `0 */2 * * *` — Every 2 hours
- `0 9 * * *` — Daily at 9AM

---

## 🧭 Admin UI
Open your worker URL (e.g., `https://your-worker.your-account.workers.dev`) and enter the `ADMIN_TOKEN`.

From there you can:
- View stats and next scheduled post
- Manage the subject queue
- Change schedule and footer
- Trigger a manual post for testing

---

## 🏗️ Architecture
```
GitHub Actions ──▶ Cloudflare Worker ──▶ Telegram API
                                                                             │
                                                                             └── KV (queue, settings, stats)
```

Project layout
```
src/
       index.js        # Worker logic (cron + API + UI)
       auth.js         # Simple admin token auth
       assets/ui/      # UI HTML/JS assets
scripts/
       update-schedule.js
.github/workflows/
       deploy.yml
wrangler.toml
```

---

## 🔧 Troubleshooting
- Schedule changed in UI but not running at new times? Run the helper and deploy:
       ```bash
       npm run update-schedule "*/5 * * * *"
       npm run deploy
       ```
- GitHub Actions fails to auth: set `CF_API_TOKEN` (Workers:Edit) and `CF_ACCOUNT_ID` secrets
- Posts not sending: verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
- No AI output: add `OPENROUTER_API_KEY` or rely on templates

---

## 🤝 Contributing
PRs welcome. Please run `npm test` and `npm run lint` before submitting.

## 📄 License
MIT



### Common Issues



| Issue | Solution |Features available:Features available:

|-------|----------|

| Posts not appearing | Check Telegram bot token and chat ID |- 📊 **Dashboard** - View statistics and recent activity- 📊 **Dashboard** - View statistics and recent activity

| Schedule not updating | Run `npm run update-schedule` + `npm run deploy` |

| GitHub Actions failing | Verify `CF_API_TOKEN` and `CF_ACCOUNT_ID` secrets |- 📝 **Subject Queue** - Manage upcoming topics- 📝 **Subject Queue** - Manage upcoming topics

| AI content not working | Check `OPENROUTER_API_KEY` secret |

| Authentication errors | Regenerate and update API tokens |- ⚙️ **Settings** - Configure schedule, footer, and preferences- ⚙️ **Settings** - Configure schedule, footer, and preferences



### Health Checks- 🔄 **Manual Trigger** - Test posts immediately- 🔄 **Manual Trigger** - Test posts immediately

- **Worker Status**: Visit worker URL for web interface

- **Schedule Status**: Check deployment logs for cron confirmation

- **API Status**: Monitor Telegram API response codes

- **Storage Status**: Verify KV namespace binding## 🏗️ **Architecture**## 🏗️ **Architecture**



## 🤝 Contributing



1. **Fork** the repository``````

2. **Create** feature branch (`git checkout -b feature/amazing-feature`)

3. **Test** your changes (`npm test`)┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐

4. **Commit** changes (`git commit -m 'Add amazing feature'`)

5. **Push** to branch (`git push origin feature/amazing-feature`)│   GitHub        │────▶│  Cloudflare      │────▶│   Telegram      ││   GitHub        │────▶│  Cloudflare      │────▶│   Telegram      │

6. **Open** Pull Request

│   Actions       │     │  Worker          │     │   API           ││   Actions       │     │  Worker          │     │   API           │

## 📄 License

└─────────────────┘     └──────────────────┘     └─────────────────┘└─────────────────┘     └──────────────────┘     └─────────────────┘

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

                               │                                                          │                           

## 🆘 Support

                               ▼                                                          ▼                           

- **Documentation**: Check [DEPLOYMENT_SETUP.md](./DEPLOYMENT_SETUP.md) and [SCHEDULE_FIX_GUIDE.md](./SCHEDULE_FIX_GUIDE.md)

- **Issues**: Open an issue on GitHub                        ┌──────────────────┐                                      ┌──────────────────┐              

- **Discussions**: Use GitHub Discussions for questions

                        │   KV Storage     │                                      │   KV Storage     │              

## 🎯 Roadmap

                        │   - Queue        │                                      │   - Queue        │              

- [ ] Multi-language support

- [ ] Advanced analytics dashboard                          │   - Settings     │                                      │   - Settings     │              

- [ ] Webhook integrations

- [ ] Custom image generation                        │   - Statistics   │                                      │   - Statistics   │              

- [ ] A/B testing for content

- [ ] Integration with trading APIs                        └──────────────────┘                                      └──────────────────┘              

- [ ] Mobile app companion

``````

---



**Made with ❤️ for the trading education community**
## 📁 **Project Structure**## 📁 **Project Structure**



``````

trading-edu-bot/trading-edu-bot/

├── src/├── src/

│   ├── index.js              # Main worker code│   ├── index.js              # Main worker code

│   ├── auth.js              # Authentication utilities│   ├── auth.js              # Authentication utilities

│   └── ui/                  # Web interface assets│   └── ui/                  # Web interface assets

├── scripts/├── scripts/

│   └── update-schedule.js   # Schedule management helper│   └── update-schedule.js   # Schedule management helper

├── tests/├── tests/

│   ├── config.test.js       # Configuration tests│   ├── config.test.js       # Configuration tests

│   └── content.test.js      # Content generation tests│   └── content.test.js      # Content generation tests

├── .github/workflows/├── .github/workflows/

│   └── deploy.yml           # CI/CD pipeline│   └── deploy.yml           # CI/CD pipeline

├── wrangler.toml           # Cloudflare configuration├── wrangler.toml           # Cloudflare configuration

├── package.json            # Dependencies and scripts├── package.json            # Dependencies and scripts

└── README.md              # This file└── README.md              # This file

``````



## 🔧 **Configuration**## 🔧 **Configuration**



### **Available Schedules**### **Available Schedules**

| Frequency | Cron Expression | Use Case || Frequency | Cron Expression | Use Case |

|-----------|----------------|----------||-----------|----------------|----------|

| Every minute | `* * * * *` | Testing/demos || Every minute | `* * * * *` | Testing/demos |

| Every 2 minutes | `*/2 * * * *` | High engagement || Every 2 minutes | `*/2 * * * *` | High engagement |

| Every 5 minutes | `*/5 * * * *` | Active communities || Every 5 minutes | `*/5 * * * *` | Active communities |

| Every 10 minutes | `*/10 * * * *` | Regular updates || Every 10 minutes | `*/10 * * * *` | Regular updates |

| Every 15 minutes | `*/15 * * * *` | Steady flow || Every 15 minutes | `*/15 * * * *` | Steady flow |

| Every 30 minutes | `*/30 * * * *` | Moderate frequency || Every 30 minutes | `*/30 * * * *` | Moderate frequency |

| Every hour | `0 * * * *` | Standard interval || Every hour | `0 * * * *` | Standard interval |

| Every 2 hours | `0 */2 * * *` | Light posting || Every 2 hours | `0 */2 * * *` | Light posting |



### **AI Models (OpenRouter)**### **AI Models (OpenRouter)**

- `deepseek/deepseek-chat-v3.1:free` - Free, good quality- `deepseek/deepseek-chat-v3.1:free` - Free, good quality

- `anthropic/claude-3-haiku` - Fast, efficient  - `anthropic/claude-3-haiku` - Fast, efficient  

- `openai/gpt-3.5-turbo` - Balanced performance- `openai/gpt-3.5-turbo` - Balanced performance

- `meta/llama-3.2-11b-vision-instruct:free` - Vision-capable- `meta/llama-3.2-11b-vision-instruct:free` - Vision-capable



## 🚀 **Deployment**## 🚀 **Deployment**



### **GitHub Actions (Recommended)**### **GitHub Actions (Recommended)**

1. Add secrets to GitHub repository settings1. Add secrets to GitHub repository settings

2. Push to `main` branch2. Push to `main` branch

3. Automatic deployment via GitHub Actions3. Automatic deployment via GitHub Actions



### **Manual Deployment**### **Manual Deployment**

```bash```bash

# Authenticate with Cloudflare# Authenticate with Cloudflare

npx wrangler loginnpx wrangler login



# Deploy directly# Deploy directly

npm run deploynpm run deploy

``````



### **Environment-Specific Deployment**### **Environment-Specific Deployment**

```bash```bash

# Production# Production

npm run deploynpm run deploy



# Development/staging# Development/staging

wrangler deploy --env developmentwrangler deploy --env development

``````



## 📊 **Monitoring & Troubleshooting**## 📊 **Monitoring & Troubleshooting**



### **Logs Access**### **Logs Access**

```bash```bash

# Real-time logs# Real-time logs

npx wrangler tailnpx wrangler tail



# Specific deployment logs  # Specific deployment logs  

npx wrangler tail --format=jsonnpx wrangler tail --format=json

``````



### **Common Issues**### **Common Issues**



| Issue | Solution || Issue | Solution |

|-------|----------||-------|----------|

| Posts not appearing | Check Telegram bot token and chat ID || Posts not appearing | Check Telegram bot token and chat ID |

| Schedule not updating | Run `npm run update-schedule` + `npm run deploy` || Schedule not updating | Run `npm run update-schedule` + `npm run deploy` |

| GitHub Actions failing | Verify `CF_API_TOKEN` and `CF_ACCOUNT_ID` secrets || GitHub Actions failing | Verify `CF_API_TOKEN` and `CF_ACCOUNT_ID` secrets |

| AI content not working | Check `OPENROUTER_API_KEY` secret || AI content not working | Check `OPENROUTER_API_KEY` secret |

| Authentication errors | Regenerate and update API tokens || Authentication errors | Regenerate and update API tokens |



### **Health Checks**### **Health Checks**

- **Worker Status**: Visit worker URL for web interface- **Worker Status**: Visit worker URL for web interface

- **Schedule Status**: Check deployment logs for cron confirmation- **Schedule Status**: Check deployment logs for cron confirmation

- **API Status**: Monitor Telegram API response codes- **API Status**: Monitor Telegram API response codes

- **Storage Status**: Verify KV namespace binding- **Storage Status**: Verify KV namespace binding



## 🤝 **Contributing**## 🤝 **Contributing**



1. **Fork** the repository1. **Fork** the repository

2. **Create** feature branch (`git checkout -b feature/amazing-feature`)2. **Create** feature branch (`git checkout -b feature/amazing-feature`)

3. **Test** your changes (`npm test`)3. **Test** your changes (`npm test`)

4. **Commit** changes (`git commit -m 'Add amazing feature'`)4. **Commit** changes (`git commit -m 'Add amazing feature'`)

5. **Push** to branch (`git push origin feature/amazing-feature`)5. **Push** to branch (`git push origin feature/amazing-feature`)

6. **Open** Pull Request6. **Open** Pull Request



## 📄 **License**## 📄 **License**



This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.



## 🆘 **Support**## 🆘 **Support**



- **Documentation**: Check [DEPLOYMENT_SETUP.md](./DEPLOYMENT_SETUP.md) and [SCHEDULE_FIX_GUIDE.md](./SCHEDULE_FIX_GUIDE.md)- **Documentation**: Check [DEPLOYMENT_SETUP.md](./DEPLOYMENT_SETUP.md) and [SCHEDULE_FIX_GUIDE.md](./SCHEDULE_FIX_GUIDE.md)

- **Issues**: Open an issue on GitHub- **Issues**: Open an issue on GitHub

- **Discussions**: Use GitHub Discussions for questions- **Discussions**: Use GitHub Discussions for questions



## 🎯 **Roadmap**## 🎯 **Roadmap**



- [ ] Multi-language support- [ ] Multi-language support

- [ ] Advanced analytics dashboard  - [ ] Advanced analytics dashboard  

- [ ] Webhook integrations- [ ] Webhook integrations

- [ ] Custom image generation- [ ] Custom image generation

- [ ] A/B testing for content- [ ] A/B testing for content

- [ ] Integration with trading APIs- [ ] Integration with trading APIs

- [ ] Mobile app companion- [ ] Mobile app companion



------



**Made with ❤️ for the trading education community****Made with ❤️ for the trading education community**

 # #   A u t h e n t i c a t i o n   S t a t u s :   U p d a t e d   2 0 2 5 - 0 9 - 1 1   1 9 : 3 7 
 
 