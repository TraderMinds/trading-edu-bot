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
  model: "openai/gpt-oss-20b:free", // Updated model for best quality
  messages: [
    {
      role: "system",
      content: `
You are an expert trading educator specializing in forex, gold (XAU/USD), and cryptocurrency markets. 
Your job is to create engaging, beautifully formatted educational content specifically designed for Telegram channels.

⚡ Content Requirements:
1. Start with an eye-catching <b>title</b> that includes emojis.
2. Write a short <i>introduction</i> that hooks the reader.
3. Organize the main content with clear <b>subheadings</b>.
4. Provide real-world <b>examples</b> and <i>simple explanations</i>.
5. Add <b>pro tips</b> and <b>warnings</b> for common mistakes.
6. Include a <b>step-by-step action guide</b>.
7. End with <b>key takeaways</b> or a quick checklist.

📱 Formatting Guidelines:
- Use HTML tags for formatting (<b>, <i>, <u>).
- Use emojis for headlines, lists, and section dividers.
- Keep paragraphs short (1–3 sentences) for mobile readability.
- Add dividers like ━━━━━━━━━━ between major sections.
- Highlight important numbers and strategies in <b>bold</b>.
- Ensure the final post is at least 250 words long.

The goal: visually appealing, easy-to-read, and highly shareable Telegram educational post about trading.
      `
    },
    {
      role: "user",
      content: "Create a Telegram post teaching traders how to master Order Blocks for Gold (XAU/USD)."
    }
  ],
  max_tokens: 1500,
  temperature: 0.7
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
  const endpoint = `${TELEGRAM_API_BASE}/bot${botToken}/sendPhoto`;
  
  // Log the request details (excluding sensitive data)
  console.log('Sending to Telegram:', {
    endpoint: endpoint.replace(botToken, '[REDACTED]'),
    captionLength: caption?.length,
    imageUrl
  });

  // Validate parameters
  if (!botToken || !chatId) {
    throw new Error('Missing required Telegram parameters');
  }

  // Prepare request body
  const body = {
    chat_id: chatId,
    photo: imageUrl,
    caption: caption || '',
    parse_mode: 'HTML'
  };

  try {
    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const txt = await res.text();
    if (!res.ok) {
      console.error('Telegram API error response:', {
        status: res.status,
        response: txt
      });
      throw new Error(`Telegram API error: ${res.status} ${txt}`);
    }
    return txt;
  } catch (error) {
    console.error('Error posting to Telegram:', error);
    throw error;
  }
}

async function buildAndSend(env) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');

  const topic = ['crypto', 'forex'][Math.floor(Math.random() * 2)];
  const prompt = `Write a short educational trading tip for ${topic} traders. Keep it actionable and friendly.`;

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

  // Keep caption reasonably short for Telegram messages
  if (caption.length > 1000) caption = caption.slice(0, 990) + '...';

  // Compose image query keywords
  const imgUrl = getUnsplashImageUrl([topic, 'trading', 'finance']);

  const sendResult = await postToTelegram(botToken, chatId, caption, imgUrl);
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
    <style>
        .loading { display: none; }
        .loading.active { display: block; }
    </style>
</head>
<body class="bg-gray-100 p-8">
    <div id="auth-section" class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 class="text-xl font-semibold mb-4">Authentication</h2>
        <div class="space-y-4">
            <input type="password" id="admin-token" class="w-full p-2 border rounded" 
                   placeholder="Enter your admin token">
            <button id="login-btn" class="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                Login
            </button>
        </div>
    </div>

    <div id="main-content" class="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6 hidden">
        <h1 class="text-2xl font-bold mb-6">Trading Education Bot Control Panel</h1>
        
        <div class="mb-8 p-6 border rounded-lg">
            <h2 class="text-xl font-semibold mb-4">Generate & Post Content</h2>
            
            <form id="generateForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">Topic/Subject</label>
                    <input type="text" id="subject" class="w-full p-2 border rounded" 
                           placeholder="e.g., Risk Management in Crypto">
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Market Type</label>
                    <select id="market" class="w-full p-2 border rounded">
                        <option value="crypto">Cryptocurrency</option>
                        <option value="forex">Forex</option>
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium mb-2">AI Model</label>
                    <select id="model" class="w-full p-2 border rounded">
                        <option value="openai/gpt-oss-20b:free">GPT OSS 20B (Fast & Free)</option>
                        <option value="openai/gpt-oss-120b:free">GPT OSS 120B (Powerful & Free)</option>
                        <option value="deepseek/deepseek-chat-v3.1:free">DeepSeek V3.1 (Advanced & Free)</option>
                        <option value="z-ai/glm-4.5-air:free">GLM 4.5 Air (Efficient & Free)</option>
                    </select>
                </div>

                <div class="preview-section hidden mt-4 p-4 bg-gray-50 rounded">
                    <h3 class="font-medium mb-2">Preview</h3>
                    <p id="previewText" class="text-gray-700"></p>
                </div>

                <div class="flex space-x-4">
                    <button type="button" id="generateBtn" 
                            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        Generate Preview
                    </button>
                    <button type="button" id="postBtn"
                            class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                        Post to Telegram
                    </button>
                </div>
            </form>
        </div>

        <div class="mb-8 p-6 border rounded-lg">
            <h2 class="text-xl font-semibold mb-4">Schedule Management</h2>
            <form id="scheduleForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">Posting Schedule</label>
                    <select id="schedule" class="w-full p-2 border rounded">
                        <option value="0 * * * *">Every hour</option>
                        <option value="0 */2 * * *">Every 2 hours</option>
                        <option value="0 */4 * * *">Every 4 hours</option>
                        <option value="0 */6 * * *">Every 6 hours</option>
                        <option value="0 */12 * * *">Every 12 hours</option>
                        <option value="0 0 * * *">Once per day</option>
                    </select>
                </div>

                <button type="button" id="updateScheduleBtn"
                        class="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600">
                    Update Schedule
                </button>
            </form>
        </div>

        <div id="status" class="mt-4 p-4 rounded hidden">
            <p class="text-center font-medium"></p>
        </div>
    </div>

    <script>
        const API_BASE = '/api';
        let generatedContent = '';

        // Check for saved token
        document.addEventListener('DOMContentLoaded', () => {
            const token = localStorage.getItem('adminToken');
            if (token) {
                document.getElementById('auth-section').classList.add('hidden');
                document.getElementById('main-content').classList.remove('hidden');
            }
        });

        // Handle login
        document.getElementById('login-btn').addEventListener('click', () => {
            const token = document.getElementById('admin-token').value;
            if (!token) {
                showStatus('Please enter an admin token', 'error');
                return;
            }
            localStorage.setItem('adminToken', token);
            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('main-content').classList.remove('hidden');
        });

        async function showStatus(message, type = 'success') {
            const status = document.getElementById('status');
            status.className = \`mt-4 p-4 rounded \${type === 'success' ? 'bg-green-100' : 'bg-red-100'}\`;
            status.querySelector('p').textContent = message;
            status.classList.remove('hidden');
            setTimeout(() => status.classList.add('hidden'), 5000);
        }

        async function generateContent() {
            const subject = document.getElementById('subject').value;
            const market = document.getElementById('market').value;
            const model = document.getElementById('model').value;
            const token = localStorage.getItem('adminToken');
            
            if (!token) {
                showStatus('Please enter your admin token first', 'error');
                return;
            }
            
            try {
                const response = await fetch(\`\${API_BASE}/generate\`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ subject, market, model })
                });

                if (!response.ok) throw new Error('Generation failed');

                const data = await response.json();
                generatedContent = data.content;

                document.querySelector('.preview-section').classList.remove('hidden');
                document.getElementById('previewText').textContent = generatedContent;
                showStatus('Content generated successfully');
            } catch (error) {
                showStatus(\`Failed to generate content: \${error.message}\`, 'error');
            }
        }

        async function postContent() {
            if (!generatedContent) {
                showStatus('Please generate content first', 'error');
                return;
            }

            const token = localStorage.getItem('adminToken');
            if (!token) {
                showStatus('Please enter your admin token first', 'error');
                return;
            }

            try {
                const response = await fetch(\`\${API_BASE}/post\`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ content: generatedContent })
                });

                if (!response.ok) throw new Error('Posting failed');

                showStatus('Posted successfully to Telegram');
                generatedContent = '';
                document.querySelector('.preview-section').classList.add('hidden');
            } catch (error) {
                showStatus(\`Failed to post: \${error.message}\`, 'error');
            }
        }

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

        // Event Listeners
        document.getElementById('generateBtn').addEventListener('click', generateContent);
        document.getElementById('postBtn').addEventListener('click', postContent);
        document.getElementById('updateScheduleBtn').addEventListener('click', updateSchedule);
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
              hasChatId: !!env.TELEGRAM_CHAT_ID
            });
            return new Response(JSON.stringify({ error: 'Telegram configuration missing' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          console.log('Posting to Telegram...', {
            contentLength: content.length,
            hasToken: !!env.TELEGRAM_BOT_TOKEN,
            hasChatId: !!env.TELEGRAM_CHAT_ID
          });

          const imgUrl = getUnsplashImageUrl(['trading', 'finance']);
          const result = await postToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, content, imgUrl);
          
          console.log('Telegram API response:', result);
          
          return new Response(JSON.stringify({ success: true, result }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Post error:', error);
          return new Response(JSON.stringify({ 
            error: error.message,
            details: error.stack 
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
