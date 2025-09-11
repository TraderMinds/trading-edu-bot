# 🤖 Trading Education Bot - Advanced Cloudflare Worker# 🤖 Trading Education Bot - Advanced Cloudflare Worker# 🤖 Trading Education Bot - Advanced Cloudflare Worker



[![Deploy Status](https://github.com/TraderMinds/trading-edu-bot/actions/workflows/deploy.yml/badge.svg)](https://github.com/TraderMinds/trading-edu-bot/actions)

[![Tests](https://img.shields.io/badge/tests-6%2F6%20passing-brightgreen)](./tests/)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)[![Deploy Status](https://github.com/TraderMinds/trading-edu-bot/actions/workflows/deploy.yml/badge.svg)](https://github.com/TraderMinds/trading-edu-bot/actions)[![Deploy Status](https://github.com/TraderMinds/trading-edu-bot/actions/workflows/deploy.yml/badge.svg)](https://github.com/TraderMinds/trading-edu-bot/actions)



> **Automated trading education delivery system** with AI-powered content generation, flexible scheduling, and comprehensive management interface.[![Tests](https://img.shields.io/badge/tests-6%2F6%20passing-brightgreen)](./tests/)[![Tests](https://img.shields.io/badge/tests-6%2F6%20passing-brightgreen)](./tests/)



## 🚀 Features[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)



### 📚 Content Generation

- **AI-Powered Posts** - Uses OpenRouter API for dynamic, contextual trading education

- **Multi-Market Support** - Crypto, Forex, Stocks, Commodities> **Automated trading education delivery system** with AI-powered content generation, flexible scheduling, and comprehensive management interface.> **Automated trading education delivery system** with AI-powered content generation, flexible scheduling, and comprehensive management interface.

- **Fallback Templates** - Built-in educational content when AI is unavailable

- **Custom Subject Queue** - Pre-populate topics for consistent content flow

- **Post Statistics** - Track posting frequency and engagement metrics

## 🚀 **Features**## 🚀 **Features**

### ⏰ Advanced Scheduling

- **Flexible Cron Scheduling** - From every minute to custom intervals

- **Minute-Level Precision** - High-frequency posting for active engagement

- **Schedule Management UI** - Easy schedule changes with deployment tracking### 📚 **Content Generation**### 📚 **Content Generation**

- **Status Indicators** - Clear feedback on schedule deployment state

- **Helper Scripts** - Automated wrangler.toml updates- **AI-Powered Posts** - Uses OpenRouter API for dynamic, contextual trading education- **AI-Powered Posts** - Uses OpenRouter API for dynamic, contextual trading education



### 🎛️ Management Interface- **Multi-Market Support** - Crypto, Forex, Stocks, Commodities- **Multi-Market Support** - Crypto, Forex, Stocks, Commodities

- **Web-Based Dashboard** - Comprehensive admin interface

- **Real-Time Statistics** - Posts per day/week/month tracking- **Fallback Templates** - Built-in educational content when AI is unavailable- **Fallback Templates** - Built-in educational content when AI is unavailable

- **Queue Management** - Add, edit, remove subjects dynamically

- **Footer Customization** - Brand your posts with custom signatures- **Custom Subject Queue** - Pre-populate topics for consistent content flow- **Custom Subject Queue** - Pre-populate topics for consistent content flow

- **Authentication System** - Secure admin access with token-based auth

- **Post Statistics** - Track posting frequency and engagement metrics- **Post Statistics** - Track posting frequency and engagement metrics

### 🔧 Technical Excellence

- **Cloudflare Workers** - Serverless, globally distributed

- **KV Storage Integration** - Persistent data storage

- **GitHub Actions CI/CD** - Automated testing and deployment### ⏰ **Advanced Scheduling**### ⏰ **Advanced Scheduling**

- **Comprehensive Testing** - 6/6 tests passing with Jest

- **ESLint Configuration** - Code quality and consistency- **Flexible Cron Scheduling** - From every minute to custom intervals- **Flexible Cron Scheduling** - From every minute to custom intervals



## 📋 Quick Start- **Minute-Level Precision** - High-frequency posting for active engagement- **Minute-Level Precision** - High-frequency posting for active engagement



### 1. Clone & Install- **Schedule Management UI** - Easy schedule changes with deployment tracking- **Schedule Management UI** - Easy schedule changes with deployment tracking

```bash

git clone https://github.com/TraderMinds/trading-edu-bot.git- **Status Indicators** - Clear feedback on schedule deployment state- **Status Indicators** - Clear feedback on schedule deployment state

cd trading-edu-bot

npm install- **Helper Scripts** - Automated wrangler.toml updates- **Helper Scripts** - Automated wrangler.toml updates

```



### 2. Configure Secrets

Set up the following environment variables in Cloudflare Workers or GitHub Secrets:### 🎛️ **Management Interface**### 🎛️ **Management Interface**



#### Required Secrets- **Web-Based Dashboard** - Comprehensive admin interface- **Web-Based Dashboard** - Comprehensive admin interface

| Secret | Description | How to Get |

|--------|-------------|------------|- **Real-Time Statistics** - Posts per day/week/month tracking- **Real-Time Statistics** - Posts per day/week/month tracking

| `TELEGRAM_BOT_TOKEN` | Bot authentication token | Create bot via [@BotFather](https://t.me/BotFather) |

| `TELEGRAM_CHAT_ID` | Target chat/channel ID | Add bot to group, get ID via API |- **Queue Management** - Add, edit, remove subjects dynamically- **Queue Management** - Add, edit, remove subjects dynamically

| `ADMIN_TOKEN` | Web interface access | Generate secure random string |

- **Footer Customization** - Brand your posts with custom signatures- **Footer Customization** - Brand your posts with custom signatures

#### Optional Secrets  

| Secret | Description | Default |- **Authentication System** - Secure admin access with token-based auth- **Authentication System** - Secure admin access with token-based auth

|--------|-------------|---------|

| `OPENROUTER_API_KEY` | AI content generation | Uses fallback templates |

| `CF_API_TOKEN` | GitHub Actions deployment | Manual deployment only |

| `CF_ACCOUNT_ID` | Cloudflare account ID | Required for GitHub Actions |### 🔧 **Technical Excellence**### 🔧 **Technical Excellence**



### 3. Deploy- **Cloudflare Workers** - Serverless, globally distributed- **Cloudflare Workers** - Serverless, globally distributed

```bash

# Local development- **KV Storage Integration** - Persistent data storage- **KV Storage Integration** - Persistent data storage

npm run start

- **GitHub Actions CI/CD** - Automated testing and deployment- **GitHub Actions CI/CD** - Automated testing and deployment

# Deploy to production

npm run deploy- **Comprehensive Testing** - 6/6 tests passing with Jest- **Comprehensive Testing** - 6/6 tests passing with Jest



# Run tests- **ESLint Configuration** - Code quality and consistency- **ESLint Configuration** - Code quality and consistency

npm test

```



## 🎯 Usage Examples## 📋 **Quick Start**## 📋 **Quick Start**



### Schedule Management



```bash### 1. **Clone & Install**### 1. **Clone & Install**

# Change to 5-minute intervals

npm run update-schedule "*/5 * * * *"```bash```bash

npm run deploy

git clone https://github.com/TraderMinds/trading-edu-bot.gitgit clone https://github.com/TraderMinds/trading-edu-bot.git

# Every 2 hours

npm run update-schedule "0 */2 * * *" cd trading-edu-botcd trading-edu-bot

npm run deploy

npm installnpm install

# Daily at 9 AM

npm run update-schedule "0 9 * * *"``````

npm run deploy

```



### Content Management### 2. **Configure Secrets**### 2. **Configure Secrets**



Access the web interface at your worker URL:Set up the following environment variables in Cloudflare Workers or GitHub Secrets:Set up the following environment variables in Cloudflare Workers or GitHub Secrets:

```

https://your-worker.your-account.workers.dev

```

#### Required Secrets#### Required Secrets

Features available:

- 📊 **Dashboard** - View statistics and recent activity| Secret | Description | How to Get || Secret | Description | How to Get |

- 📝 **Subject Queue** - Manage upcoming topics

- ⚙️ **Settings** - Configure schedule, footer, and preferences|--------|-------------|------------||--------|-------------|------------|

- 🔄 **Manual Trigger** - Test posts immediately

| `TELEGRAM_BOT_TOKEN` | Bot authentication token | Create bot via [@BotFather](https://t.me/BotFather) || `TELEGRAM_BOT_TOKEN` | Bot authentication token | Create bot via [@BotFather](https://t.me/BotFather) |

## 🏗️ Architecture

| `TELEGRAM_CHAT_ID` | Target chat/channel ID | Add bot to group, get ID via API || `TELEGRAM_CHAT_ID` | Target chat/channel ID | Add bot to group, get ID via API |

```

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐| `ADMIN_TOKEN` | Web interface access | Generate secure random string || `ADMIN_TOKEN` | Web interface access | Generate secure random string |

│   GitHub        │────▶│  Cloudflare      │────▶│   Telegram      │

│   Actions       │     │  Worker          │     │   API           │

└─────────────────┘     └──────────────────┘     └─────────────────┘

                               │                           #### Optional Secrets  #### Optional Secrets  

                               ▼                           

                        ┌──────────────────┐              | Secret | Description | Default || Secret | Description | Default |

                        │   KV Storage     │              

                        │   - Queue        │              |--------|-------------|---------||--------|-------------|---------|

                        │   - Settings     │              

                        │   - Statistics   │              | `OPENROUTER_API_KEY` | AI content generation | Uses fallback templates || `OPENROUTER_API_KEY` | AI content generation | Uses fallback templates |

                        └──────────────────┘              

```| `CF_API_TOKEN` | GitHub Actions deployment | Manual deployment only || `CF_API_TOKEN` | GitHub Actions deployment | Manual deployment only |



## 📁 Project Structure| `CF_ACCOUNT_ID` | Cloudflare account ID | Required for GitHub Actions || `CF_ACCOUNT_ID` | Cloudflare account ID | Required for GitHub Actions |



```

trading-edu-bot/

├── src/### 3. **Deploy**### 3. **Deploy**

│   ├── index.js              # Main worker code

│   ├── auth.js               # Authentication utilities```bash```bash

│   └── ui/                   # Web interface assets

├── scripts/# Local development# Local development

│   └── update-schedule.js    # Schedule management helper

├── tests/npm run startnpm run start

│   ├── config.test.js        # Configuration tests

│   └── content.test.js       # Content generation tests

├── .github/workflows/

│   └── deploy.yml            # CI/CD pipeline# Deploy to production# Deploy to production

├── wrangler.toml            # Cloudflare configuration

├── package.json             # Dependencies and scriptsnpm run deploynpm run deploy

└── README.md               # This file

```



## 🔧 Configuration# Run tests# Run tests



### Available Schedulesnpm testnpm test

| Frequency | Cron Expression | Use Case |

|-----------|----------------|----------|``````

| Every minute | `* * * * *` | Testing/demos |

| Every 2 minutes | `*/2 * * * *` | High engagement |

| Every 5 minutes | `*/5 * * * *` | Active communities |

| Every 10 minutes | `*/10 * * * *` | Regular updates |## 🎯 **Usage Examples**## 🎯 **Usage Examples**

| Every 15 minutes | `*/15 * * * *` | Steady flow |

| Every 30 minutes | `*/30 * * * *` | Moderate frequency |

| Every hour | `0 * * * *` | Standard interval |

| Every 2 hours | `0 */2 * * *` | Light posting |### **Schedule Management**### **Schedule Management**



### AI Models (OpenRouter)

- `deepseek/deepseek-chat-v3.1:free` - Free, good quality

- `anthropic/claude-3-haiku` - Fast, efficient  ```bash```bash

- `openai/gpt-3.5-turbo` - Balanced performance

- `meta/llama-3.2-11b-vision-instruct:free` - Vision-capable# Change to 5-minute intervals# Change to 5-minute intervals



## 🚀 Deploymentnpm run update-schedule "*/5 * * * *"npm run update-schedule "*/5 * * * *"



### GitHub Actions (Recommended)npm run deploynpm run deploy

1. Add secrets to GitHub repository settings

2. Push to `main` branch

3. Automatic deployment via GitHub Actions

# Every 2 hours# Every 2 hours

### Manual Deployment

```bashnpm run update-schedule "0 */2 * * *" npm run update-schedule "0 */2 * * *" 

# Authenticate with Cloudflare

npx wrangler loginnpm run deploynpm run deploy



# Deploy directly

npm run deploy

```# Daily at 9 AM# Daily at 9 AM



### Environment-Specific Deploymentnpm run update-schedule "0 9 * * *"npm run update-schedule "0 9 * * *"

```bash

# Productionnpm run deploynpm run deploy

npm run deploy

``````

# Development/staging

wrangler deploy --env development

```

### **Content Management**### **Content Management**

## 📊 Monitoring & Troubleshooting



### Logs Access

```bashAccess the web interface at your worker URL:Access the web interface at your worker URL:

# Real-time logs

npx wrangler tail``````



# Specific deployment logs  https://your-worker.your-account.workers.devhttps://your-worker.your-account.workers.dev

npx wrangler tail --format=json

`````````



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