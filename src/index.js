// Cloudflare Worker: scheduled hourly to post trading educational content to Telegram

// Environment vars expected:
// TELEGRAM_BOT_TOKEN - required
// TELEGRAM_CHAT_ID - required
// OPENROUTER_API_KEY - optional (if provided, worker will call OpenRouter for text generation)

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

// Utility function for delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Queue management functions using KV storage
async function getSubjectsQueue(env) {
  try {
    const queue = await env.SUBJECTS_QUEUE?.get('queue');
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Error getting queue:', error);
    return [];
  }
}

async function getPostFooter(env) {
  try {
    const footer = await env.SUBJECTS_QUEUE?.get('post_footer');
    return footer ? JSON.parse(footer) : {
      companyName: "TradingBot Pro",
      telegramChannel: "@tradingpro",
      website: "tradingbot.com",
      enabled: true
    };
  } catch (error) {
    console.error('Error getting footer:', error);
    return {
      companyName: "TradingBot Pro",
      telegramChannel: "@tradingpro", 
      website: "tradingbot.com",
      enabled: true
    };
  }
}

async function savePostFooter(env, footerData) {
  try {
    if (env.SUBJECTS_QUEUE) {
      await env.SUBJECTS_QUEUE.put('post_footer', JSON.stringify(footerData));
    }
    return true;
  } catch (error) {
    console.error('Error saving footer:', error);
    return false;
  }
}

async function getPostingStats(env) {
  try {
    const stats = await env.SUBJECTS_QUEUE?.get('posting_stats');
    return stats ? JSON.parse(stats) : {
      totalPosts: 0,
      successfulPosts: 0,
      failedPosts: 0,
      lastPostDate: null,
      postsThisMonth: 0,
      postsThisWeek: 0
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    return {
      totalPosts: 0,
      successfulPosts: 0,
      failedPosts: 0,
      lastPostDate: null,
      postsThisMonth: 0,
      postsThisWeek: 0
    };
  }
}

async function updatePostingStats(env, success = true) {
  try {
    const stats = await getPostingStats(env);
    const now = new Date();
    
    stats.totalPosts++;
    if (success) {
      stats.successfulPosts++;
    } else {
      stats.failedPosts++;
    }
    
    stats.lastPostDate = now.toISOString();
    
    // Calculate this month and week posts
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastPostMonth = stats.lastPostDate ? new Date(stats.lastPostDate).getMonth() : -1;
    const lastPostYear = stats.lastPostDate ? new Date(stats.lastPostDate).getFullYear() : -1;
    
    if (thisMonth !== lastPostMonth || thisYear !== lastPostYear) {
      stats.postsThisMonth = 1;
    } else {
      stats.postsThisMonth++;
    }
    
    // Simple week calculation
    const daysDiff = Math.floor((now - new Date(stats.lastPostDate || 0)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 7) {
      stats.postsThisWeek = 1;
    } else {
      stats.postsThisWeek++;
    }
    
    if (env.SUBJECTS_QUEUE) {
      await env.SUBJECTS_QUEUE.put('posting_stats', JSON.stringify(stats));
    }
    
    return stats;
  } catch (error) {
    console.error('Error updating stats:', error);
    return null;
  }
}

async function saveSubjectsQueue(env, queue) {
  try {
    if (env.SUBJECTS_QUEUE) {
      await env.SUBJECTS_QUEUE.put('queue', JSON.stringify(queue));
    }
    return true;
  } catch (error) {
    console.error('Error saving queue:', error);
    return false;
  }
}

async function addSubjectToQueue(env, subject, market = 'crypto') {
  const queue = await getSubjectsQueue(env);
  const newItem = {
    id: Date.now().toString(),
    subject: subject.trim(),
    market,
    addedAt: new Date().toISOString(),
    processed: false
  };
  queue.push(newItem);
  await saveSubjectsQueue(env, queue);
  return newItem;
}

async function getNextSubject(env) {
  const queue = await getSubjectsQueue(env);
  return queue.find(item => !item.processed) || null;
}

async function markSubjectProcessed(env, subjectId) {
  const queue = await getSubjectsQueue(env);
  const item = queue.find(q => q.id === subjectId);
  if (item) {
    item.processed = true;
    item.processedAt = new Date().toISOString();
    await saveSubjectsQueue(env, queue);
  }
}

async function removeSubjectFromQueue(env, subjectId) {
  const queue = await getSubjectsQueue(env);
  const filteredQueue = queue.filter(item => item.id !== subjectId);
  await saveSubjectsQueue(env, filteredQueue);
}

// Structured error logging
function logError(error, context = {}) {
  console.error(JSON.stringify({
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...context
  }));
}

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      
      // Handle rate limits specially
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After') || RETRY_DELAY;
        await sleep(parseInt(retryAfter) * 1000);
        continue;
      }
      
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(RETRY_DELAY * Math.pow(2, i)); // Exponential backoff
    }
  }
}

async function generateTextWithOpenRouter(prompt, apiKey) {
  if (!apiKey) {
    throw new Error('OpenRouter API key is required');
  }

  const url = 'https://openrouter.ai/api/v1/chat/completions';
  console.log('Generating content with OpenRouter API key:', apiKey ? 'Present' : 'Missing');
  
  const body = {
    model: 'openai/gpt-oss-20b:free', // Using free OpenAI OSS model
    messages: [
      { 
        role: 'system', 
        content: `You are an expert trading educator specializing in forex and cryptocurrency markets.
        Create beautifully formatted educational content for Telegram that includes:

        1. An eye-catching title with emojis
        2. A clear introduction
        3. Main content sections with subheadings
        4. Examples and explanations
        5. Tips and warnings
        6. Action steps
        7. Key takeaways

        Formatting Guidelines:
        - Use HTML tags for formatting (<b>bold</b>, <u>underline</u>, <i>italic</i>)
        - Use emojis extensively but appropriately
        - Create clear section breaks with emoji dividers
        - Use bullet points and numbered lists where appropriate
        - Format important points in bold
        - Add relevant emojis for each section
        - Keep paragraphs short for mobile readability
        - Use dividers (e.g., ━━━━━━━━━━) between major sections

        Minimum length should be 500 words.
        Make it visually appealing and easy to read on mobile devices.`
      },
      { role: 'user', content: prompt }
    ],
    max_tokens: 1500, // Increased token limit for longer content
    temperature: 0.7 // Balanced between creativity and consistency
  };

  console.log('Making OpenRouter API request with body:', JSON.stringify(body));
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://trading-edu-bot-worker.tradermindai.workers.dev',
        'X-Title': 'Trading Education Bot',
        'X-Model': body.model
      },
      body: JSON.stringify(body)
    });

    console.log('OpenRouter API response status:', res.status);
    
    if (!res.ok) {
      const txt = await res.text();
      console.error('OpenRouter API error response:', txt);
      throw new Error(`API error (${res.status}): ${txt}`);
    }

    const json = await res.json();
    console.log('OpenRouter API response:', JSON.stringify(json));
    
    // Handle OpenRouter response format
    if (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) {
      const content = json.choices[0].message.content.trim();
      console.log('Generated content length:', content.length);
      return content;
    }
    
    // Try alternative response shapes
    if (json.output) {
      const content = String(json.output).trim();
      console.log('Generated content length (output):', content.length);
      return content;
    }
    if (json.text) {
      const content = String(json.text).trim();
      console.log('Generated content length (text):', content.length);
      return content;
    }
    
    // If no known response shape matches, log the response and throw error
    console.error('Unexpected API response shape:', JSON.stringify(json));
    throw new Error('Unexpected response format from OpenRouter API');
  } catch (error) {
    console.error('OpenRouter API error:', error);
    throw error;
  }
}

function fallbackText(topic) {
  const tips = [
    // Comprehensive Risk Management Guide
    `🎯 <b>Ultimate Guide to Risk Management in ${topic} Trading</b> 📊
⏱ Reading Time: 4 minutes

━━━━━━━━━━ Introduction ━━━━━━━━━━

🔍 Understanding risk management is <b>crucial for long-term success</b> in ${topic} trading. In this comprehensive guide, we'll break down the essential components of professional risk management.

━━━━━━━━━━ Core Principles ━━━━━━━━━━

📌 <b>1. Position Sizing Fundamentals</b>

• Never risk more than 1-2% per trade
• Calculate position size based on:
  ↳ Account balance
  ↳ Stop loss distance
  ↳ Market volatility

⚠️ <b>WARNING:</b> <i>Overleveraging is the #1 reason traders blow their accounts!</i>

🎯 <b>2. Strategic Stop Loss Placement</b>

• Set stops <u>before</u> entering trades
• Place at key technical levels:
  ↳ Support/Resistance breaks
  ↳ Trend line violations
  ↳ Pattern invalidation points

💡 <b>PRO TIP:</b> <i>Add 1-2% buffer for market noise</i>

🔄 <b>3. Risk-Reward Optimization</b>

• Target minimum 1:2 risk-reward ratio
• Scale positions intelligently:
  ↳ Reduce size after losses
  ↳ Increase after verified edge
  ↳ Match size to setup quality

🏆 <b>WINNING STRATEGY:</b> <i>Start small, scale up with success</i>

📊 <b>4. Portfolio Risk Management</b>

• Monitor correlations between pairs
• Max portfolio risk: 5-6% total
• Diversify across:
  ↳ Different timeframes
  ↳ Multiple strategies
  ↳ Uncorrelated assets

⚠️ <b>CRITICAL:</b> <i>Never risk your entire portfolio on correlated positions!</i>

🎯 <b>5. Implementation Checklist</b>

<b>Before Trading:</b>
✓ Calculate max position size
✓ Set clear stop loss level
✓ Define profit targets
✓ Check correlations

<b>During Trading:</b>
✓ Monitor price action
✓ Follow your plan
✓ No emotional decisions

<b>After Trading:</b>
✓ Document everything
✓ Calculate R:R ratio
✓ Review performance
✓ Update journal

━━━━━━━━━━ Key Takeaways ━━━━━━━━━━

🎯 <b>Remember These Points:</b>

1️⃣ Position sizing is <u>non-negotiable</u>
2️⃣ Always know your max loss
3️⃣ Keep detailed trading records
4️⃣ Scale positions wisely
5️⃣ Review and adjust regularly

⭐️ <b>GOLDEN RULE:</b> <i>Protection of capital comes first, profits second!</i>

━━━━━━━━━━ Action Steps ━━━━━━━━━━

📝 <b>Your Next Steps:</b>

1. Calculate your per-trade risk limit
2. Create a position sizing spreadsheet
3. Start your trading journal today
4. Review your last 10 trades
5. Adjust your risk parameters

🎓 <b>Final Thought:</b> <i>Success in ${topic} trading starts with mastering risk management. Start implementing these principles today!</i>

#Trading #RiskManagement #${topic} #TradingEducation

Remember: Professional traders focus on risk management first, profits second. Your primary goal should be capital preservation, which enables long-term participation in the markets.`,

    // Comprehensive Technical Analysis Guide
    `📈 Mastering Technical Analysis in ${topic} Trading

A comprehensive approach to technical analysis combines multiple timeframes and indicators to identify high-probability trading opportunities. Here's your complete guide:

1. Multiple Timeframe Analysis
- Higher timeframes (Daily/Weekly): Identify primary trend
- Medium timeframes (4H/1H): Find trading setups
- Lower timeframes (15M/5M): Fine-tune entries
- Always align trades with higher timeframe trend

2. Key Technical Tools
a) Price Action:
   - Support and resistance levels
   - Trend lines and channels
   - Chart patterns
   - Candlestick formations

b) Indicators:
   - Trend: Moving averages, MACD
   - Momentum: RSI, Stochastic
   - Volume: OBV, Volume Profile
   - Volatility: Bollinger Bands, ATR

3. Trading Strategy Integration
- Combine price action with indicator confirmation
- Use volume to validate breakouts
- Monitor market structure for trend changes
- Implement multiple confirmation signals

4. Advanced Concepts
- Order flow analysis
- Market profile and volume profile
- Fibonacci retracements and extensions
- Elliot Wave Theory basics

5. Practical Implementation
Step 1: Market Analysis
- Check higher timeframe trend
- Identify key support/resistance
- Note significant price levels

Step 2: Setup Identification
- Look for pattern formation
- Check indicator alignment
- Confirm with volume

Step 3: Entry Execution
- Wait for pattern completion
- Verify indicator confirmation
- Check risk-reward ratio

Key Takeaways:
1. Always start with higher timeframe analysis
2. Use multiple confirmation tools
3. Volume confirms price action
4. Patterns repeat across timeframes
5. Risk management trumps perfect entry

Remember: Technical analysis is a probability tool, not a guarantee. Combine it with proper risk management for best results.`
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

function getUnsplashImageUrl(keywords) {
  // Use Unsplash Source to get a relevant free image. No API key required.
  // Example: https://source.unsplash.com/1600x900/?crypto,finance
  const q = encodeURIComponent(keywords.join(','));
  return `https://source.unsplash.com/1600x900/?${q}`;
}

async function postToTelegram(botToken, chatId, caption, imageUrl) {
  // Validate parameters
  if (!botToken || !chatId) {
    throw new Error(`Missing required Telegram parameters: botToken=${!!botToken}, chatId=${!!chatId}`);
  }

  // Validate bot token format
  if (!botToken.includes(':') || botToken.length < 40) {
    throw new Error('Invalid Telegram bot token format');
  }

  // Validate chat ID format (should be number or string starting with @)
  if (!chatId.toString().match(/^(-?\d+|@\w+)$/)) {
    console.warn('Unusual chat ID format:', chatId);
  }

  const endpoint = `${TELEGRAM_API_BASE}/bot${botToken}/sendPhoto`;
  
  // Log the request details (excluding sensitive data)
  console.log('Sending to Telegram:', {
    endpoint: endpoint.replace(botToken, '[REDACTED]'),
    captionLength: caption?.length,
    imageUrl: imageUrl?.substring(0, 50) + '...',
    chatId: chatId
  });

  // Prepare request body
  const body = {
    chat_id: chatId,
    photo: imageUrl,
    caption: caption || '',
    parse_mode: 'HTML'
  };

  console.log('Request body prepared:', {
    chat_id: body.chat_id,
    photo: body.photo?.substring(0, 50) + '...',
    captionLength: body.caption.length,
    parse_mode: body.parse_mode
  });

  try {
    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'TradingBot/1.0'
      },
      body: JSON.stringify(body)
    });

    const txt = await res.text();
    console.log('Telegram API response status:', res.status);
    
    if (!res.ok) {
      console.error('Telegram API error response:', {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        response: txt
      });
      
      // Parse common Telegram errors
      let errorMsg = `Telegram API error: ${res.status}`;
      try {
        const errorData = JSON.parse(txt);
        if (errorData.description) {
          errorMsg += ` - ${errorData.description}`;
        }
      } catch (e) {
        errorMsg += ` - ${txt}`;
      }
      
      throw new Error(errorMsg);
    }
    
    console.log('Telegram post successful');
    return txt;
  } catch (error) {
    console.error('Error posting to Telegram:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
}

async function buildAndSend(env) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');

  // Check if there's a subject in the queue
  const nextSubject = await getNextSubject(env);
  
  let topic, prompt;
  if (nextSubject) {
    console.log('Processing queued subject:', nextSubject);
    topic = nextSubject.market;
    prompt = `Create a comprehensive educational guide about "${nextSubject.subject}" for ${nextSubject.market} traders. Make it detailed, informative, and actionable.`;
  } else {
    // Fallback to random topics if queue is empty
    topic = ['crypto', 'forex'][Math.floor(Math.random() * 2)];
    prompt = `Write a detailed educational trading guide for ${topic} traders. Keep it actionable and comprehensive.`;
  }

  let caption = '';
  if (env.OPENROUTER_API_KEY) {
    try {
      caption = await generateTextWithOpenRouter(prompt, env.OPENROUTER_API_KEY);
    } catch (err) {
      // fallback to template if AI call fails
      console.error('OpenRouter call failed:', err.message);
      caption = fallbackText(topic);
    }
  } else {
    caption = fallbackText(topic);
  }

  // Add footer to caption if enabled
  const footer = await getPostFooter(env);
  if (footer.enabled) {
    const footerText = `\n\n━━━━━━━━━━━━━━━━━━━━\n📈 <b>${footer.companyName || 'TradingBot Pro'}</b>\n📱 ${footer.telegramChannel || '@tradingbot'}\n🌐 ${footer.website || 'tradingbot.com'}\n\n#TradingEducation #${topic.charAt(0).toUpperCase() + topic.slice(1)}Trading`;
    caption += footerText;
  }

  // Keep caption within Telegram limits (1024 characters for photo captions)
  // Telegram has a 1024 character limit for photo captions, not 4096
  if (caption.length > 1020) {
    caption = caption.slice(0, 1000) + '...\n\n' + (footer.enabled ? `📈 <b>${footer.companyName || 'TradingBot Pro'}</b>` : '');
  }

  // Compose image query keywords
  const imgUrl = getUnsplashImageUrl([topic, 'trading', 'finance']);

  console.log('Final caption length:', caption.length);
  console.log('Image URL:', imgUrl);

  const sendResult = await postToTelegram(botToken, chatId, caption, imgUrl);
  
  // Update posting statistics
  await updatePostingStats(env, true);
  
  // Mark subject as processed and remove from queue if it was from queue
  if (nextSubject) {
    await removeSubjectFromQueue(env, nextSubject.id);
    console.log('Subject processed and removed from queue:', nextSubject.subject);
  }
  
  return sendResult;
}

export default {
  async scheduled(event, env, ctx) {
    // Use waitUntil so the scheduled event can finish asynchronously
    ctx.waitUntil((async () => {
      try {
        const res = await buildAndSend(env);
        console.log('Posted to Telegram:', res);
      } catch (err) {
        console.error('Error in scheduled job:', err);
      }
    })());
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Serve UI files
    if (path === '/' || path === '/index.html') {
      // Serve the UI content directly
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trading Education Bot Control Panel</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        .loading { display: none; }
        .loading.active { display: block; }
        .progress-bar {
            transition: width 0.3s ease-in-out;
        }
        .card-hover {
            transition: all 0.3s ease;
        }
        .card-hover:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .gradient-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .stats-card {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .success-card {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        .warning-card {
            background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
        }
        .pulse-animation {
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        .notification {
            animation: slideInRight 0.5s ease-out;
        }
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    </style>
</head>
<body class="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
    <!-- Loading Overlay -->
    <div id="loading-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center hidden">
        <div class="bg-white p-8 rounded-lg shadow-xl">
            <div class="flex items-center space-x-3">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span class="text-gray-700 font-medium">Processing...</span>
            </div>
        </div>
    </div>

    <!-- Authentication Section -->
    <div id="auth-section" class="min-h-screen flex items-center justify-center p-6">
        <div class="max-w-md w-full">
            <div class="gradient-bg rounded-lg shadow-xl p-8 text-white text-center mb-6">
                <i class="fas fa-chart-line text-4xl mb-4"></i>
                <h1 class="text-2xl font-bold">Trading Education Bot</h1>
                <p class="text-blue-100 mt-2">Advanced Content Management System</p>
            </div>
            <div class="bg-white rounded-lg shadow-xl p-6 card-hover">
                <h2 class="text-xl font-semibold mb-4 text-gray-800">
                    <i class="fas fa-lock mr-2"></i>Authentication Required
                </h2>
                <div class="space-y-4">
                    <input type="password" id="admin-token" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                           placeholder="Enter your admin token">
                    <button id="login-btn" class="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                        <i class="fas fa-sign-in-alt mr-2"></i>Login
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Main Content -->
    <div id="main-content" class="hidden min-h-screen p-6">
        <div class="max-w-7xl mx-auto">
            <!-- Header -->
            <div class="gradient-bg rounded-lg shadow-xl p-6 text-white mb-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-3xl font-bold flex items-center">
                            <i class="fas fa-robot mr-3"></i>Trading Education Bot
                        </h1>
                        <p class="text-blue-100 mt-1">Advanced AI-Powered Content Management</p>
                    </div>
                    <button id="logout-btn" class="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition-colors duration-200">
                        <i class="fas fa-sign-out-alt mr-2"></i>Logout
                    </button>
                </div>
            </div>

            <!-- Statistics Dashboard -->
            <div id="stats-section" class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div class="stats-card rounded-lg shadow-lg p-6 text-white card-hover">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-pink-100">Total Posts</p>
                            <p id="total-posts" class="text-2xl font-bold">0</p>
                        </div>
                        <i class="fas fa-chart-bar text-2xl text-pink-200"></i>
                    </div>
                </div>
                <div class="success-card rounded-lg shadow-lg p-6 text-white card-hover">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-blue-100">Successful Posts</p>
                            <p id="success-posts" class="text-2xl font-bold">0</p>
                        </div>
                        <i class="fas fa-check-circle text-2xl text-blue-200"></i>
                    </div>
                </div>
                <div class="warning-card rounded-lg shadow-lg p-6 text-white card-hover">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-green-100">Queue Items</p>
                            <p id="queue-count" class="text-2xl font-bold">0</p>
                        </div>
                        <i class="fas fa-list text-2xl text-green-200"></i>
                    </div>
                </div>
                <div class="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white card-hover">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-purple-100">Last Post</p>
                            <p id="last-post" class="text-sm font-medium">Never</p>
                        </div>
                        <i class="fas fa-clock text-2xl text-purple-200"></i>
                    </div>
                </div>
            </div>
        
            <!-- Main Content Grid -->
            <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <!-- Left Column -->
                <div class="xl:col-span-2 space-y-6">
                    <!-- Future Posts Queue -->
                    <div class="bg-white rounded-lg shadow-lg p-6 card-hover">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-xl font-bold text-gray-800 flex items-center">
                                <i class="fas fa-queue mr-2 text-blue-600"></i>Future Posts Queue
                            </h2>
                            <span id="queue-status" class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                <i class="fas fa-circle text-xs mr-1"></i>Active
                            </span>
                        </div>
                        
                        <div class="space-y-4">
                            <div class="bg-gray-50 p-4 rounded-lg">
                                <div class="flex space-x-4 mb-3">
                                    <input type="text" id="newSubject" class="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                                           placeholder="Enter subject for future post (e.g., Technical Analysis Basics)">
                                    <select id="newSubjectMarket" class="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500">
                                        <option value="crypto">📈 Crypto</option>
                                        <option value="forex">💱 Forex</option>
                                    </select>
                                </div>
                                <div class="flex space-x-2">
                                    <button type="button" id="addSubjectBtn" 
                                            class="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                                        <i class="fas fa-plus mr-2"></i>Add to Queue
                                    </button>
                                    <button type="button" id="bulkAddBtn" 
                                            class="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200">
                                        <i class="fas fa-layer-group mr-2"></i>Bulk Add
                                    </button>
                                </div>
                            </div>

                            <div id="queueList" class="space-y-3 max-h-96 overflow-y-auto">
                                <div class="flex items-center justify-center py-8">
                                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <span class="ml-3 text-gray-500">Loading queue...</span>
                                </div>
                            </div>

                            <div class="flex space-x-3">
                                <button type="button" id="refreshQueueBtn" 
                                        class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                                    <i class="fas fa-sync-alt mr-2"></i>Refresh
                                </button>
                                <button type="button" id="clearQueueBtn" 
                                        class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200">
                                    <i class="fas fa-trash mr-2"></i>Clear All
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Manual Generate & Post -->
                    <div class="bg-white rounded-lg shadow-lg p-6 card-hover">
                        <h2 class="text-xl font-bold text-gray-800 mb-6 flex items-center">
                            <i class="fas fa-magic mr-2 text-purple-600"></i>Manual Generate & Post
                        </h2>
                        
                        <form id="generateForm" class="space-y-4">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-2 text-gray-700">
                                        <i class="fas fa-lightbulb mr-1"></i>Topic/Subject
                                    </label>
                                    <input type="text" id="subject" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                                           placeholder="e.g., Risk Management in Crypto">
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium mb-2 text-gray-700">
                                        <i class="fas fa-chart-line mr-1"></i>Market Type
                                    </label>
                                    <select id="market" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500">
                                        <option value="crypto">📈 Cryptocurrency</option>
                                        <option value="forex">💱 Forex</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-medium mb-2 text-gray-700">
                                    <i class="fas fa-brain mr-1"></i>AI Model
                                </label>
                                <select id="model" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500">
                                    <option value="openai/gpt-oss-20b:free">🚀 GPT OSS 20B (Fast & Free)</option>
                                    <option value="openai/gpt-oss-120b:free">⚡ GPT OSS 120B (Powerful & Free)</option>
                                    <option value="deepseek/deepseek-chat-v3.1:free">🧠 DeepSeek V3.1 (Advanced & Free)</option>
                                    <option value="z-ai/glm-4.5-air:free">💨 GLM 4.5 Air (Efficient & Free)</option>
                                </select>
                            </div>

                            <!-- Progress Bar -->
                            <div id="generation-progress" class="hidden">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-sm font-medium text-gray-700">Generating content...</span>
                                    <span id="progress-percent" class="text-sm text-gray-500">0%</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2">
                                    <div id="progress-bar" class="progress-bar bg-blue-600 h-2 rounded-full" style="width: 0%"></div>
                                </div>
                            </div>

                            <div id="preview-section" class="hidden mt-4 p-4 bg-gray-50 rounded-lg border">
                                <h3 class="font-medium mb-3 flex items-center text-gray-800">
                                    <i class="fas fa-eye mr-2"></i>Preview
                                </h3>
                                <div id="previewText" class="text-gray-700 max-h-64 overflow-y-auto p-3 bg-white rounded border"></div>
                                <div class="mt-3 text-sm text-gray-500">
                                    <span id="content-stats"></span>
                                </div>
                            </div>

                            <div class="flex space-x-3">
                                <button type="button" id="generateBtn" 
                                        class="flex-1 bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-colors duration-200">
                                    <i class="fas fa-cog mr-2"></i>Generate Preview
                                </button>
                                <button type="button" id="postBtn"
                                        class="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200">
                                    <i class="fas fa-paper-plane mr-2"></i>Post to Telegram
                                </button>
                                <button type="button" id="saveTemplateBtn"
                                        class="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                                    <i class="fas fa-save mr-2"></i>Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="space-y-6">
                    <!-- Post Footer Customization -->
                    <div class="bg-white rounded-lg shadow-lg p-6 card-hover">
                        <h2 class="text-xl font-bold text-gray-800 mb-6 flex items-center">
                            <i class="fas fa-signature mr-2 text-green-600"></i>Post Footer Settings
                        </h2>
                        
                        <form id="footerForm" class="space-y-4">
                            <div>
                                <label class="flex items-center mb-3">
                                    <input type="checkbox" id="footerEnabled" class="mr-3 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded">
                                    <span class="text-sm font-medium text-gray-700">Enable Footer</span>
                                </label>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-2 text-gray-700">
                                    <i class="fas fa-building mr-1"></i>Company Name
                                </label>
                                <input type="text" id="companyName" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" 
                                       placeholder="e.g., TradingBot Pro">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-2 text-gray-700">
                                    <i class="fab fa-telegram mr-1"></i>Telegram Channel
                                </label>
                                <input type="text" id="telegramChannel" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" 
                                       placeholder="e.g., @tradingpro">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-2 text-gray-700">
                                    <i class="fas fa-globe mr-1"></i>Website
                                </label>
                                <input type="text" id="website" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" 
                                       placeholder="e.g., tradingbot.com">
                            </div>

                            <!-- Footer Preview -->
                            <div class="bg-gray-50 p-4 rounded-lg border">
                                <h4 class="text-sm font-medium text-gray-700 mb-2">Footer Preview:</h4>
                                <div id="footerPreview" class="text-sm text-gray-600 font-mono bg-white p-3 rounded border">
                                    <!-- Footer preview will be populated here -->
                                </div>
                            </div>
                            
                            <button type="button" id="saveFooterBtn" 
                                    class="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200">
                                <i class="fas fa-save mr-2"></i>Save Footer Settings
                            </button>
                        </form>
                    </div>

                    <!-- Schedule Management -->
                    <div class="bg-white rounded-lg shadow-lg p-6 card-hover">
                        <h2 class="text-xl font-bold text-gray-800 mb-6 flex items-center">
                            <i class="fas fa-clock mr-2 text-orange-600"></i>Schedule Management
                        </h2>
                        <form id="scheduleForm" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-2 text-gray-700">
                                    <i class="fas fa-calendar-alt mr-1"></i>Posting Schedule
                                </label>
                                <select id="schedule" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500">
                                    <option value="0 * * * *">⚡ Every hour</option>
                                    <option value="0 */2 * * *">🕐 Every 2 hours</option>
                                    <option value="0 */4 * * *">🕓 Every 4 hours</option>
                                    <option value="0 */6 * * *">🕕 Every 6 hours</option>
                                    <option value="0 */12 * * *">🌓 Every 12 hours</option>
                                    <option value="0 0 * * *">🌅 Once per day</option>
                                    <option value="0 0 * * 1">📅 Weekly (Monday)</option>
                                </select>
                            </div>

                            <div class="bg-orange-50 p-4 rounded-lg border border-orange-200">
                                <h4 class="text-sm font-medium text-orange-800 mb-2">Next Scheduled Post:</h4>
                                <p id="nextPost" class="text-orange-700 font-mono">Calculating...</p>
                            </div>

                            <button type="button" id="updateScheduleBtn"
                                    class="w-full bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 transition-colors duration-200">
                                <i class="fas fa-clock mr-2"></i>Update Schedule
                            </button>
                        </form>
                    </div>

                    <!-- Quick Actions -->
                    <div class="bg-white rounded-lg shadow-lg p-6 card-hover">
                        <h2 class="text-xl font-bold text-gray-800 mb-6 flex items-center">
                            <i class="fas fa-bolt mr-2 text-yellow-600"></i>Quick Actions
                        </h2>
                        <div class="space-y-3">
                            <button id="testPostBtn" class="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                                <i class="fas fa-vial mr-2"></i>Test Post Now
                            </button>
                            <button id="debugBtn" class="w-full bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 transition-colors duration-200">
                                <i class="fas fa-bug mr-2"></i>Debug Configuration
                            </button>
                            <button id="exportQueueBtn" class="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-200">
                                <i class="fas fa-download mr-2"></i>Export Queue
                            </button>
                            <button id="importQueueBtn" class="w-full bg-cyan-600 text-white px-4 py-3 rounded-lg hover:bg-cyan-700 transition-colors duration-200">
                                <i class="fas fa-upload mr-2"></i>Import Queue
                            </button>
                        </div>
                        <input type="file" id="importFile" accept=".json" class="hidden">
                    </div>

                    <!-- Debug Information -->
                    <div id="debugPanel" class="bg-white rounded-lg shadow-lg p-6 card-hover hidden">
                        <h2 class="text-xl font-bold text-gray-800 mb-6 flex items-center">
                            <i class="fas fa-microscope mr-2 text-red-600"></i>Debug Information
                        </h2>
                        <div class="space-y-4">
                            <div class="bg-gray-50 p-4 rounded-lg">
                                <h4 class="font-medium text-gray-700 mb-2">Environment Variables:</h4>
                                <div id="envStatus" class="space-y-1 text-sm font-mono">
                                    <div>TELEGRAM_BOT_TOKEN: <span class="loading">Checking...</span></div>
                                    <div>TELEGRAM_CHAT_ID: <span class="loading">Checking...</span></div>
                                    <div>OPENROUTER_API_KEY: <span class="loading">Checking...</span></div>
                                </div>
                            </div>
                            <div class="bg-gray-50 p-4 rounded-lg">
                                <h4 class="font-medium text-gray-700 mb-2">Last Error Details:</h4>
                                <pre id="lastError" class="text-sm bg-red-50 p-3 rounded border text-red-800 overflow-auto max-h-32">
No errors recorded yet
                                </pre>
                            </div>
                            <button id="clearDebugBtn" class="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
                                <i class="fas fa-eraser mr-2"></i>Clear Debug Info
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Notifications Container -->
        <div id="notifications" class="fixed top-4 right-4 z-40 space-y-2"></div>

        <!-- Bulk Add Modal -->
        <div id="bulkModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center hidden">
            <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-bold text-gray-800">Bulk Add Subjects</h3>
                    <button id="closeBulkModal" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="space-y-4">
                    <textarea id="bulkSubjects" rows="8" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" 
                              placeholder="Enter one subject per line:&#10;Risk Management Basics&#10;Technical Analysis Guide&#10;Forex Trading Tips"></textarea>
                    <select id="bulkMarket" class="w-full p-3 border rounded-lg">
                        <option value="crypto">Cryptocurrency</option>
                        <option value="forex">Forex</option>
                    </select>
                    <div class="flex space-x-3">
                        <button id="cancelBulkAdd" class="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">
                            Cancel
                        </button>
                        <button id="confirmBulkAdd" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                            Add All
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const API_BASE = '/api';
        let generatedContent = '';
        let currentFooterSettings = {};

        // Check for saved token
        document.addEventListener('DOMContentLoaded', () => {
            const token = localStorage.getItem('adminToken');
            if (token) {
                document.getElementById('auth-section').classList.add('hidden');
                document.getElementById('main-content').classList.remove('hidden');
                initializeDashboard();
            }
        });

        async function initializeDashboard() {
            await Promise.all([
                loadQueue(),
                loadStats(),
                loadFooterSettings(),
                calculateNextPost()
            ]);
            updateFooterPreview();
        }

        // Handle login
        document.getElementById('login-btn').addEventListener('click', async () => {
            const token = document.getElementById('admin-token').value;
            if (!token) {
                showNotification('Please enter an admin token', 'error');
                return;
            }
            
            showLoading(true);
            localStorage.setItem('adminToken', token);
            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('main-content').classList.remove('hidden');
            
            try {
                await initializeDashboard();
                showNotification('Welcome back! Dashboard loaded successfully', 'success');
            } catch (error) {
                showNotification('Failed to load dashboard data', 'warning');
            } finally {
                showLoading(false);
            }
        });

        // Handle logout
        document.addEventListener('click', (e) => {
            if (e.target.id === 'logout-btn') {
                localStorage.removeItem('adminToken');
                document.getElementById('main-content').classList.add('hidden');
                document.getElementById('auth-section').classList.remove('hidden');
                showNotification('Logged out successfully', 'info');
            }
        });

        async function loadStats() {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            try {
                const response = await fetch(\`\${API_BASE}/stats\`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (response.ok) {
                    const data = await response.json();
                    updateStatsDisplay(data.stats);
                }
            } catch (error) {
                console.error('Failed to load stats:', error);
            }
        }

        function updateStatsDisplay(stats) {
            document.getElementById('total-posts').textContent = stats.totalPosts || 0;
            document.getElementById('success-posts').textContent = stats.successfulPosts || 0;
            
            const lastPost = stats.lastPostDate 
                ? new Date(stats.lastPostDate).toLocaleString() 
                : 'Never';
            document.getElementById('last-post').textContent = lastPost;
        }

        function showNotification(message, type = 'success', duration = 5000) {
            const notifications = document.getElementById('notifications');
            const notification = document.createElement('div');
            
            const iconMap = {
                success: 'fas fa-check-circle',
                error: 'fas fa-exclamation-circle',
                warning: 'fas fa-exclamation-triangle',
                info: 'fas fa-info-circle'
            };
            
            const colorMap = {
                success: 'bg-green-500',
                error: 'bg-red-500', 
                warning: 'bg-yellow-500',
                info: 'bg-blue-500'
            };
            
            notification.className = \`notification \${colorMap[type]} text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 max-w-sm\`;
            notification.innerHTML = \`
                <i class="\${iconMap[type]}"></i>
                <span class="flex-1">\${message}</span>
                <button onclick="this.parentElement.remove()" class="text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            \`;
            
            notifications.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }

        function showLoading(show = true) {
            const overlay = document.getElementById('loading-overlay');
            if (show) {
                overlay.classList.remove('hidden');
            } else {
                overlay.classList.add('hidden');
            }
        }

        function updateProgressBar(percent) {
            const progressBar = document.getElementById('progress-bar');
            const progressPercent = document.getElementById('progress-percent');
            const progressContainer = document.getElementById('generation-progress');
            
            if (percent > 0) {
                progressContainer.classList.remove('hidden');
                progressBar.style.width = percent + '%';
                progressPercent.textContent = Math.round(percent) + '%';
            } else {
                progressContainer.classList.add('hidden');
            }
        }

        async function generateContent() {
            const subject = document.getElementById('subject').value;
            const market = document.getElementById('market').value;
            const model = document.getElementById('model').value;
            const token = localStorage.getItem('adminToken');
            
            if (!token) {
                showNotification('Please enter your admin token first', 'error');
                return;
            }

            if (!subject.trim()) {
                showNotification('Please enter a subject', 'warning');
                return;
            }
            
            try {
                // Start progress animation
                updateProgressBar(10);
                const generateBtn = document.getElementById('generateBtn');
                const originalText = generateBtn.innerHTML;
                generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';
                generateBtn.disabled = true;

                // Simulate progress updates
                let progress = 10;
                const progressInterval = setInterval(() => {
                    progress += Math.random() * 20;
                    if (progress > 90) progress = 90;
                    updateProgressBar(progress);
                }, 500);

                const response = await fetch(\`\${API_BASE}/generate\`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ subject, market, model })
                });

                clearInterval(progressInterval);
                updateProgressBar(100);

                if (!response.ok) throw new Error('Generation failed');

                const data = await response.json();
                generatedContent = data.content;

                document.getElementById('preview-section').classList.remove('hidden');
                document.getElementById('previewText').innerHTML = generatedContent;
                
                // Update content stats
                const wordCount = generatedContent.split(' ').length;
                const charCount = generatedContent.length;
                document.getElementById('content-stats').textContent = 
                    \`\${wordCount} words, \${charCount} characters\`;

                showNotification('Content generated successfully!', 'success');
                
                setTimeout(() => updateProgressBar(0), 1000);
            } catch (error) {
                updateProgressBar(0);
                showNotification(\`Failed to generate content: \${error.message}\`, 'error');
            } finally {
                const generateBtn = document.getElementById('generateBtn');
                generateBtn.innerHTML = originalText;
                generateBtn.disabled = false;
            }
        }

        async function postContent() {
            if (!generatedContent) {
                showNotification('Please generate content first', 'error');
                return;
            }

            const token = localStorage.getItem('adminToken');
            if (!token) {
                showNotification('Please enter your admin token first', 'error');
                return;
            }

            try {
                showLoading(true);
                const response = await fetch(\`\${API_BASE}/post\`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ content: generatedContent })
                });

                if (!response.ok) throw new Error('Posting failed');

                showNotification('Posted successfully to Telegram! 🎉', 'success');
                generatedContent = '';
                document.getElementById('preview-section').classList.add('hidden');
                
                // Refresh stats after successful post
                await loadStats();
            } catch (error) {
                showNotification(\`Failed to post: \${error.message}\`, 'error');
            } finally {
                showLoading(false);
            }
        }

        async function loadFooterSettings() {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            try {
                const response = await fetch(\`\${API_BASE}/footer\`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (response.ok) {
                    const data = await response.json();
                    currentFooterSettings = data.footer;
                    populateFooterForm(data.footer);
                }
            } catch (error) {
                console.error('Failed to load footer settings:', error);
            }
        }

        function populateFooterForm(footer) {
            document.getElementById('footerEnabled').checked = footer.enabled;
            document.getElementById('companyName').value = footer.companyName || '';
            document.getElementById('telegramChannel').value = footer.telegramChannel || '';
            document.getElementById('website').value = footer.website || '';
        }

        function updateFooterPreview() {
            const enabled = document.getElementById('footerEnabled').checked;
            const companyName = document.getElementById('companyName').value;
            const telegramChannel = document.getElementById('telegramChannel').value;
            const website = document.getElementById('website').value;

            const preview = document.getElementById('footerPreview');
            
            if (!enabled) {
                preview.textContent = 'Footer disabled';
                return;
            }

            const footerText = \`━━━━━━━━━━━━━━━━━━━━
📈 \${companyName || 'Company Name'}
📱 \${telegramChannel || '@channel'}
🌐 \${website || 'website.com'}

#TradingEducation #CryptoTrading\`;
            
            preview.textContent = footerText;
        }

        async function saveFooterSettings() {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            const footerData = {
                enabled: document.getElementById('footerEnabled').checked,
                companyName: document.getElementById('companyName').value,
                telegramChannel: document.getElementById('telegramChannel').value,
                website: document.getElementById('website').value
            };

            try {
                showLoading(true);
                const response = await fetch(\`\${API_BASE}/footer\`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ footer: footerData })
                });

                if (!response.ok) throw new Error('Failed to save footer settings');
                
                currentFooterSettings = footerData;
                showNotification('Footer settings saved successfully!', 'success');
            } catch (error) {
                showNotification(\`Failed to save footer settings: \${error.message}\`, 'error');
            } finally {
                showLoading(false);
            }
        }

        // Auto-update footer preview when inputs change
        document.addEventListener('input', (e) => {
            if (['footerEnabled', 'companyName', 'telegramChannel', 'website'].includes(e.target.id)) {
                updateFooterPreview();
            }
        });

        async function updateSchedule() {
            const schedule = document.getElementById('schedule').value;
            
            const token = localStorage.getItem('adminToken');
            if (!token) {
                showStatus('Please enter your admin token first', 'error');
                return;
            }

            try {
                const response = await fetch(\`\${API_BASE}/schedule\`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ schedule })
                });

                if (!response.ok) throw new Error('Schedule update failed');
                showStatus('Schedule updated successfully');
            } catch (error) {
                showStatus(\`Failed to update schedule: \${error.message}\`, 'error');
            }
        }

        async function loadQueue() {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            try {
                const response = await fetch(\`\${API_BASE}/queue\`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (!response.ok) throw new Error('Failed to load queue');

                const data = await response.json();
                displayQueue(data.queue || []);
            } catch (error) {
                document.getElementById('queueList').innerHTML = 
                    '<p class="text-red-500">Failed to load queue</p>';
            }
        }

        function displayQueue(queue) {
            const queueList = document.getElementById('queueList');
            const queueCount = document.getElementById('queue-count');
            
            queueCount.textContent = queue.length;
            
            if (queue.length === 0) {
                queueList.innerHTML = \`
                    <div class="text-center py-8">
                        <i class="fas fa-inbox text-4xl text-gray-300 mb-3"></i>
                        <p class="text-gray-500">No subjects in queue</p>
                        <p class="text-gray-400 text-sm">Add some topics to get started!</p>
                    </div>
                \`;
                return;
            }

            queueList.innerHTML = queue.map((item, index) => \`
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border hover:shadow-sm transition-shadow card-hover">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-1">
                            <span class="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                                #\${index + 1}
                            </span>
                            <span class="font-medium text-gray-800">\${item.subject}</span>
                        </div>
                        <div class="flex items-center space-x-3 text-sm text-gray-500">
                            <span class="flex items-center">
                                <i class="fas fa-chart-line mr-1"></i>
                                \${item.market.charAt(0).toUpperCase() + item.market.slice(1)}
                            </span>
                            <span class="flex items-center">
                                <i class="fas fa-clock mr-1"></i>
                                \${new Date(item.addedAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="moveSubjectUp('\${item.id}')" 
                                class="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition-colors"
                                title="Move up">
                            <i class="fas fa-arrow-up text-xs"></i>
                        </button>
                        <button onclick="removeSubject('\${item.id}')" 
                                class="bg-red-500 text-white p-2 rounded hover:bg-red-600 transition-colors"
                                title="Remove">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            \`).join('');
        }

        async function addSubject() {
            const subject = document.getElementById('newSubject').value.trim();
            const market = document.getElementById('newSubjectMarket').value;
            const token = localStorage.getItem('adminToken');
            
            if (!token) {
                showNotification('Please enter your admin token first', 'error');
                return;
            }

            if (!subject) {
                showNotification('Please enter a subject', 'warning');
                return;
            }
            
            try {
                showLoading(true);
                const response = await fetch(\`\${API_BASE}/queue\`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ subject, market })
                });

                if (!response.ok) throw new Error('Failed to add subject');

                document.getElementById('newSubject').value = '';
                showNotification('Subject added to queue successfully!', 'success');
                await loadQueue();
            } catch (error) {
                showNotification(\`Failed to add subject: \${error.message}\`, 'error');
            } finally {
                showLoading(false);
            }
        }

        async function bulkAddSubjects() {
            const subjects = document.getElementById('bulkSubjects').value
                .split('\\n')
                .map(s => s.trim())
                .filter(s => s.length > 0);
            
            const market = document.getElementById('bulkMarket').value;
            const token = localStorage.getItem('adminToken');
            
            if (!token) return;
            if (subjects.length === 0) {
                showNotification('Please enter at least one subject', 'warning');
                return;
            }

            try {
                showLoading(true);
                let successCount = 0;
                
                for (const subject of subjects) {
                    try {
                        const response = await fetch(\`\${API_BASE}/queue\`, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            },
                            body: JSON.stringify({ subject, market })
                        });
                        if (response.ok) successCount++;
                    } catch (error) {
                        console.error('Failed to add subject:', subject, error);
                    }
                }

                document.getElementById('bulkSubjects').value = '';
                document.getElementById('bulkModal').classList.add('hidden');
                showNotification(\`Added \${successCount} of \${subjects.length} subjects successfully!\`, 'success');
                await loadQueue();
            } catch (error) {
                showNotification(\`Bulk add failed: \${error.message}\`, 'error');
            } finally {
                showLoading(false);
            }
        }

        async function moveSubjectUp(subjectId) {
            // This would require backend support for reordering
            showNotification('Reordering coming soon!', 'info');
        }

        async function clearQueue() {
            if (!confirm('Are you sure you want to clear all subjects from the queue?')) return;
            
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            try {
                showLoading(true);
                const response = await fetch(\`\${API_BASE}/queue/clear\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (!response.ok) throw new Error('Failed to clear queue');
                
                showNotification('Queue cleared successfully!', 'success');
                await loadQueue();
            } catch (error) {
                showNotification(\`Failed to clear queue: \${error.message}\`, 'error');
            } finally {
                showLoading(false);
            }
        }

        async function testPost() {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            try {
                showLoading(true);
                const response = await fetch(\`\${API_BASE}/test-post\`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                const data = await response.json();
                
                if (!response.ok) {
                    // Store the error for debugging
                    document.getElementById('lastError').textContent = 
                        \`Status: \${response.status}\nError: \${data.error}\nDetails: \${data.details || 'No additional details'}\nTimestamp: \${data.timestamp || new Date().toISOString()}\`;
                    throw new Error(data.error || 'Test post failed');
                }
                
                showNotification('Test post sent successfully! 🚀', 'success');
                await loadStats();
            } catch (error) {
                console.error('Test post error:', error);
                showNotification(\`Test post failed: \${error.message}\`, 'error');
                
                // Show debug panel automatically on error
                document.getElementById('debugPanel').classList.remove('hidden');
            } finally {
                showLoading(false);
            }
        }

        async function debugConfiguration() {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            try {
                showLoading(true);
                const response = await fetch(\`\${API_BASE}/debug\`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Debug check failed');
                }

                // Update debug panel
                document.getElementById('debugPanel').classList.remove('hidden');
                
                const envStatus = document.getElementById('envStatus');
                envStatus.innerHTML = \`
                    <div class="flex justify-between">
                        <span>TELEGRAM_BOT_TOKEN:</span> 
                        <span class="\${data.environment.hasBotToken ? 'text-green-600' : 'text-red-600'}">
                            \${data.environment.hasBotToken ? '✓ Set' : '✗ Missing'}
                            \${data.environment.hasBotToken ? \` (\${data.environment.botTokenLength} chars, \${data.environment.botTokenFormat})\` : ''}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span>TELEGRAM_CHAT_ID:</span> 
                        <span class="\${data.environment.hasChatId ? 'text-green-600' : 'text-red-600'}">
                            \${data.environment.hasChatId ? '✓ Set' : '✗ Missing'}
                            \${data.environment.hasChatId ? \` (\${data.environment.chatId}, \${data.environment.chatIdType})\` : ''}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span>OPENROUTER_API_KEY:</span> 
                        <span class="\${data.environment.hasOpenRouterKey ? 'text-green-600' : 'text-yellow-600'}">
                            \${data.environment.hasOpenRouterKey ? '✓ Set' : '⚠ Missing (Optional)'}
                            \${data.environment.hasOpenRouterKey ? \` (\${data.environment.openRouterKeyLength} chars)\` : ''}
                        </span>
                    </div>
                    <div class="mt-3 pt-3 border-t">
                        <div class="flex justify-between">
                            <span>Configuration Status:</span> 
                            <span class="\${data.validation.configurationComplete ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}">
                                \${data.validation.configurationComplete ? '✓ READY' : '✗ INCOMPLETE'}
                            </span>
                        </div>
                    </div>
                \`;

                // Show configuration instructions if incomplete
                if (!data.validation.configurationComplete) {
                    showNotification('Configuration incomplete! Check the debug panel for details.', 'error', 10000);
                } else {
                    showNotification('Configuration looks good! You can try the test post now.', 'success');
                }
                
            } catch (error) {
                console.error('Debug check error:', error);
                showNotification(\`Debug check failed: \${error.message}\`, 'error');
            } finally {
                showLoading(false);
            }
        }

        function exportQueue() {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            fetch(\`\${API_BASE}/queue\`, {
                headers: { 'Authorization': 'Bearer ' + token }
            })
            .then(response => response.json())
            .then(data => {
                const blob = new Blob([JSON.stringify(data.queue, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = \`queue-export-\${new Date().toISOString().split('T')[0]}.json\`;
                a.click();
                URL.revokeObjectURL(url);
                showNotification('Queue exported successfully!', 'success');
            })
            .catch(error => {
                showNotification(\`Export failed: \${error.message}\`, 'error');
            });
        }

        function calculateNextPost() {
            const schedule = document.getElementById('schedule').value;
            const nextElement = document.getElementById('nextPost');
            
            // This is a simplified calculation
            const now = new Date();
            let next = new Date(now);
            
            switch(schedule) {
                case '0 * * * *':
                    next.setHours(next.getHours() + 1, 0, 0, 0);
                    break;
                case '0 */2 * * *':
                    next.setHours(next.getHours() + 2, 0, 0, 0);
                    break;
                case '0 */4 * * *':
                    next.setHours(next.getHours() + 4, 0, 0, 0);
                    break;
                default:
                    next.setHours(next.getHours() + 1, 0, 0, 0);
            }
            
            nextElement.textContent = next.toLocaleString();
        }

        async function removeSubject(id) {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            try {
                const response = await fetch(\`\${API_BASE}/queue/\${id}\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (!response.ok) throw new Error('Failed to remove subject');

                showStatus('Subject removed from queue');
                loadQueue();
            } catch (error) {
                showStatus(\`Failed to remove subject: \${error.message}\`, 'error');
            }
        }

        // Event Listeners
        document.getElementById('generateBtn').addEventListener('click', generateContent);
        document.getElementById('postBtn').addEventListener('click', postContent);
        document.getElementById('updateScheduleBtn').addEventListener('click', updateSchedule);
        document.getElementById('addSubjectBtn').addEventListener('click', addSubject);
        document.getElementById('refreshQueueBtn').addEventListener('click', loadQueue);
        document.getElementById('saveFooterBtn').addEventListener('click', saveFooterSettings);
        document.getElementById('clearQueueBtn').addEventListener('click', clearQueue);
        document.getElementById('testPostBtn').addEventListener('click', testPost);
        document.getElementById('debugBtn').addEventListener('click', debugConfiguration);
        document.getElementById('exportQueueBtn').addEventListener('click', exportQueue);
        document.getElementById('clearDebugBtn').addEventListener('click', () => {
            document.getElementById('lastError').textContent = 'No errors recorded yet';
            document.getElementById('debugPanel').classList.add('hidden');
        });
        
        // Bulk operations
        document.getElementById('bulkAddBtn').addEventListener('click', () => {
            document.getElementById('bulkModal').classList.remove('hidden');
        });
        document.getElementById('closeBulkModal').addEventListener('click', () => {
            document.getElementById('bulkModal').classList.add('hidden');
        });
        document.getElementById('cancelBulkAdd').addEventListener('click', () => {
            document.getElementById('bulkModal').classList.add('hidden');
        });
        document.getElementById('confirmBulkAdd').addEventListener('click', bulkAddSubjects);

        // Schedule change updates next post time
        document.getElementById('schedule').addEventListener('change', calculateNextPost);

        // Add Enter key support for adding subjects
        document.getElementById('newSubject').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addSubject();
            }
        });

        // Admin token input Enter key support
        document.getElementById('admin-token').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('login-btn').click();
            }
        });

        // Close modal when clicking outside
        document.getElementById('bulkModal').addEventListener('click', (e) => {
            if (e.target.id === 'bulkModal') {
                document.getElementById('bulkModal').classList.add('hidden');
            }
        });
    </script>
</body>
</html>`;
      return new Response(html, { 
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=3600'
        } 
      });
    }

    // API Endpoints
    if (path.startsWith('/api/')) {
      // Check admin token for all API endpoints
      const adminToken = request.headers.get('Authorization')?.replace('Bearer ', '');
      if (!adminToken || adminToken !== env.ADMIN_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }

      if (path === '/api/generate' && request.method === 'POST') {
        try {
          // Validate request body
          const { subject, market, model } = await request.json();
          if (!subject || !market || !model) {
            return new Response(JSON.stringify({ error: 'Missing required fields: subject, market, and model are required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Generate detailed prompt with formatting instructions
          const prompt = `Create a beautifully formatted educational guide about ${subject} for ${market} traders.

          Structure the content as follows:
          1. Title Section:
             - Eye-catching title with relevant emojis
             - Brief hook or introduction
             - Reading time estimate

          2. Main Content:
             - Detailed explanation of ${subject} and its importance in ${market} trading
             - Key concepts and principles
             - Real-world examples with clear explanations
             - Common mistakes to avoid (with warning emojis)
             - Pro tips and advanced strategies
             - Risk management guidelines specific to this topic

          3. Practical Application:
             - Step-by-step implementation guide
             - Actionable checklist
             - Key metrics to monitor
             - Tools and indicators to use

          4. Closing:
             - Summary of key points
             - Action steps
             - Motivational closing note

          Make it visually appealing with:
          - Appropriate emojis for each section
          - Clear formatting (bold, underline, italic)
          - Dividers between sections
          - Bullet points and numbered lists
          - Important points highlighted in bold
          - Warning sections for critical points`;

          let content = '';
          if (env.OPENROUTER_API_KEY) {
            try {
              content = await generateTextWithOpenRouter(prompt, env.OPENROUTER_API_KEY);
              if (!content) {
                throw new Error('No content generated');
              }
              
              // Additional formatting for Telegram
              content = content
                .replace(/\n\s*\n/g, '\n\n') // Standardize spacing
                .replace(/•/g, '•') // Standardize bullet points
                .replace(/---/g, '\n━━━━━━━━━━\n') // Nice dividers
                .replace(/\*(.*?)\*/g, '<b>$1</b>') // Convert *text* to <b>text</b>
                .replace(/_(.*?)_/g, '<i>$1</i>') // Convert _text_ to <i>text</i>
                .replace(/~(.*?)~/g, '<u>$1</u>'); // Convert ~text~ to <u>text</u>
            } catch (aiError) {
              console.error('AI generation error:', aiError);
              // Fallback to template if AI fails
              content = fallbackText(market);
            }
          } else {
            // If no API key, use fallback
            content = fallbackText(market);
          }

          return new Response(JSON.stringify({ content }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Generation error:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to generate content: ' + (error.message || 'Unknown error') 
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      if (path === '/api/post' && request.method === 'POST') {
        try {
          const { content } = await request.json();
          if (!content) {
            console.error('No content provided in request body');
            return new Response(JSON.stringify({ error: 'No content provided' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
            console.error('Missing Telegram configuration:', {
              hasToken: !!env.TELEGRAM_BOT_TOKEN,
              hasChatId: !!env.TELEGRAM_CHAT_ID,
              tokenLength: env.TELEGRAM_BOT_TOKEN?.length || 0,
              chatId: env.TELEGRAM_CHAT_ID
            });
            return new Response(JSON.stringify({ 
              error: 'Telegram configuration missing. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.' 
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          console.log('Manual post attempt...', {
            contentLength: content.length,
            hasToken: !!env.TELEGRAM_BOT_TOKEN,
            hasChatId: !!env.TELEGRAM_CHAT_ID,
            tokenPrefix: env.TELEGRAM_BOT_TOKEN?.substring(0, 10) + '...',
            chatId: env.TELEGRAM_CHAT_ID
          });

          // Add footer to manual posts too
          let finalContent = content;
          const footer = await getPostFooter(env);
          if (footer.enabled) {
            const footerText = `\n\n━━━━━━━━━━━━━━━━━━━━\n📈 <b>${footer.companyName || 'TradingBot Pro'}</b>\n📱 ${footer.telegramChannel || '@tradingbot'}\n🌐 ${footer.website || 'tradingbot.com'}\n\n#TradingEducation`;
            finalContent += footerText;
          }

          // Ensure content is within limits
          if (finalContent.length > 1020) {
            finalContent = finalContent.slice(0, 1000) + '...\n\n' + (footer.enabled ? `📈 <b>${footer.companyName || 'TradingBot Pro'}</b>` : '');
          }

          const imgUrl = getUnsplashImageUrl(['trading', 'finance']);
          const result = await postToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, finalContent, imgUrl);
          
          console.log('Manual post successful');
          await updatePostingStats(env, true);
          
          return new Response(JSON.stringify({ success: true, result }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Manual post error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
          await updatePostingStats(env, false);
          return new Response(JSON.stringify({ 
            error: error.message,
            details: error.stack 
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Queue management endpoints
      if (path === '/api/queue' && request.method === 'GET') {
        try {
          const queue = await getSubjectsQueue(env);
          return new Response(JSON.stringify({ queue }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      if (path === '/api/queue' && request.method === 'POST') {
        try {
          const { subject, market } = await request.json();
          if (!subject) {
            return new Response(JSON.stringify({ error: 'Subject is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          const newItem = await addSubjectToQueue(env, subject, market || 'crypto');
          return new Response(JSON.stringify({ success: true, item: newItem }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      if (path.startsWith('/api/queue/') && request.method === 'DELETE') {
        try {
          const subjectId = path.split('/').pop();
          if (subjectId === 'clear') {
            // Clear entire queue
            await saveSubjectsQueue(env, []);
          } else {
            await removeSubjectFromQueue(env, subjectId);
          }
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Stats endpoint
      if (path === '/api/stats' && request.method === 'GET') {
        try {
          const stats = await getPostingStats(env);
          return new Response(JSON.stringify({ stats }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Footer management endpoints
      if (path === '/api/footer' && request.method === 'GET') {
        try {
          const footer = await getPostFooter(env);
          return new Response(JSON.stringify({ footer }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      if (path === '/api/footer' && request.method === 'POST') {
        try {
          const { footer } = await request.json();
          await savePostFooter(env, footer);
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Debug endpoint
      if (path === '/api/debug' && request.method === 'GET') {
        try {
          const debugInfo = {
            timestamp: new Date().toISOString(),
            environment: {
              hasBotToken: !!env.TELEGRAM_BOT_TOKEN,
              botTokenLength: env.TELEGRAM_BOT_TOKEN?.length || 0,
              botTokenFormat: env.TELEGRAM_BOT_TOKEN ? 
                (env.TELEGRAM_BOT_TOKEN.includes(':') ? 'Valid format' : 'Invalid format (missing colon)') : 
                'Not set',
              hasChatId: !!env.TELEGRAM_CHAT_ID,
              chatId: env.TELEGRAM_CHAT_ID || 'Not set',
              chatIdType: env.TELEGRAM_CHAT_ID ? 
                (env.TELEGRAM_CHAT_ID.toString().startsWith('-') ? 'Group/Channel' : 
                 env.TELEGRAM_CHAT_ID.toString().startsWith('@') ? 'Username' : 'Private chat') : 'Not set',
              hasOpenRouterKey: !!env.OPENROUTER_API_KEY,
              openRouterKeyLength: env.OPENROUTER_API_KEY?.length || 0
            },
            validation: {
              botTokenValid: env.TELEGRAM_BOT_TOKEN && 
                           env.TELEGRAM_BOT_TOKEN.includes(':') && 
                           env.TELEGRAM_BOT_TOKEN.length > 40,
              chatIdValid: env.TELEGRAM_CHAT_ID && 
                          env.TELEGRAM_CHAT_ID.toString().match(/^(-?\d+|@\w+)$/),
              configurationComplete: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID)
            }
          };

          return new Response(JSON.stringify(debugInfo), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ 
            error: 'Debug check failed',
            details: error.message 
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Test post endpoint
      if (path === '/api/test-post' && request.method === 'POST') {
        try {
          console.log('=== TEST POST STARTED ===');
          console.log('Timestamp:', new Date().toISOString());
          
          // Environment check
          console.log('Environment check:');
          console.log('- TELEGRAM_BOT_TOKEN exists:', !!env.TELEGRAM_BOT_TOKEN);
          console.log('- TELEGRAM_BOT_TOKEN length:', env.TELEGRAM_BOT_TOKEN?.length || 0);
          console.log('- TELEGRAM_BOT_TOKEN format check:', env.TELEGRAM_BOT_TOKEN?.includes(':') ? 'PASS' : 'FAIL');
          console.log('- TELEGRAM_CHAT_ID exists:', !!env.TELEGRAM_CHAT_ID);
          console.log('- TELEGRAM_CHAT_ID value:', env.TELEGRAM_CHAT_ID);
          console.log('- OPENROUTER_API_KEY exists:', !!env.OPENROUTER_API_KEY);
          
          if (!env.TELEGRAM_BOT_TOKEN) {
            const error = 'TELEGRAM_BOT_TOKEN environment variable is not set. Please configure it using: wrangler secret put TELEGRAM_BOT_TOKEN';
            console.error('CRITICAL ERROR:', error);
            throw new Error(error);
          }
          
          if (!env.TELEGRAM_BOT_TOKEN.includes(':')) {
            const error = 'TELEGRAM_BOT_TOKEN format is invalid. It should look like: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
            console.error('CRITICAL ERROR:', error);
            throw new Error(error);
          }
          
          if (!env.TELEGRAM_CHAT_ID) {
            const error = 'TELEGRAM_CHAT_ID environment variable is not set. Please configure it using: wrangler secret put TELEGRAM_CHAT_ID';
            console.error('CRITICAL ERROR:', error);
            throw new Error(error);
          }
          
          console.log('Environment validation passed, proceeding with test post...');
          const result = await buildAndSend(env);
          console.log('=== TEST POST COMPLETED SUCCESSFULLY ===');
          
          return new Response(JSON.stringify({ 
            success: true, 
            result,
            message: 'Test post sent successfully!'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('=== TEST POST FAILED ===');
          console.error('Error name:', error.name);
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
          
          await updatePostingStats(env, false);
          return new Response(JSON.stringify({ 
            error: error.message,
            details: error.stack,
            timestamp: new Date().toISOString()
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Return 404 for unknown API endpoints
      return new Response('Not Found', { status: 404 });
    }

    // Return 404 for unknown paths
    return new Response('Not Found', { status: 404 });
  }
};
