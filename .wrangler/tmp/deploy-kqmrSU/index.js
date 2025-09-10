var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var TELEGRAM_API_BASE = "https://api.telegram.org";
async function generateTextWithOpenRouter(prompt, apiKey) {
  if (!apiKey) {
    throw new Error("OpenRouter API key is required");
  }
  const url = "https://openrouter.ai/api/v1/chat/completions";
  console.log("Generating content with OpenRouter API key:", apiKey ? "Present" : "Missing");
  const body = {
    model: "openai/gpt-oss-20b:free",
    // Using free OpenAI OSS model
    messages: [
      {
        role: "system",
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
        - Use dividers (e.g., \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501) between major sections

        Minimum length should be 500 words.
        Make it visually appealing and easy to read on mobile devices.`
      },
      { role: "user", content: prompt }
    ],
    max_tokens: 1500,
    // Increased token limit for longer content
    temperature: 0.7
    // Balanced between creativity and consistency
  };
  console.log("Making OpenRouter API request with body:", JSON.stringify(body));
  try {
    const res2 = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://trading-edu-bot-worker.tradermindai.workers.dev",
        "X-Title": "Trading Education Bot",
        "X-Model": "openai/gpt-oss-20b:free"
      },
      body: JSON.stringify(body)
    });
    console.log("OpenRouter API response status:", res2.status);
    if (!res2.ok) {
      const txt = await res2.text();
      console.error("OpenRouter API error response:", txt);
      throw new Error(`API error (${res2.status}): ${txt}`);
    }
  } catch (fetchError) {
    console.error("OpenRouter API fetch error:", fetchError);
    throw fetchError;
  }
  try {
    const json = await res.json();
    console.log("OpenRouter API response:", JSON.stringify(json));
    if (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) {
      const content = json.choices[0].message.content.trim();
      console.log("Generated content length:", content.length);
      return content;
    }
    if (json.output) {
      const content = String(json.output).trim();
      console.log("Generated content length (output):", content.length);
      return content;
    }
    if (json.text) {
      const content = String(json.text).trim();
      console.log("Generated content length (text):", content.length);
      return content;
    }
    console.error("Unexpected API response shape:", JSON.stringify(json));
    throw new Error("Unexpected response format from OpenRouter API");
  } catch (parseError) {
    console.error("Failed to parse API response:", parseError);
    throw new Error("Failed to parse API response");
  }
}
__name(generateTextWithOpenRouter, "generateTextWithOpenRouter");
function fallbackText(topic) {
  const tips = [
    // Comprehensive Risk Management Guide
    `\u{1F3AF} <b>Ultimate Guide to Risk Management in ${topic} Trading</b> \u{1F4CA}
\u23F1 Reading Time: 4 minutes

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501 Introduction \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

\u{1F50D} Understanding risk management is <b>crucial for long-term success</b> in ${topic} trading. In this comprehensive guide, we'll break down the essential components of professional risk management.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501 Core Principles \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

\u{1F4CC} <b>1. Position Sizing Fundamentals</b>

\u2022 Never risk more than 1-2% per trade
\u2022 Calculate position size based on:
  \u21B3 Account balance
  \u21B3 Stop loss distance
  \u21B3 Market volatility

\u26A0\uFE0F <b>WARNING:</b> <i>Overleveraging is the #1 reason traders blow their accounts!</i>

\u{1F3AF} <b>2. Strategic Stop Loss Placement</b>

\u2022 Set stops <u>before</u> entering trades
\u2022 Place at key technical levels:
  \u21B3 Support/Resistance breaks
  \u21B3 Trend line violations
  \u21B3 Pattern invalidation points

\u{1F4A1} <b>PRO TIP:</b> <i>Add 1-2% buffer for market noise</i>

\u{1F504} <b>3. Risk-Reward Optimization</b>

\u2022 Target minimum 1:2 risk-reward ratio
\u2022 Scale positions intelligently:
  \u21B3 Reduce size after losses
  \u21B3 Increase after verified edge
  \u21B3 Match size to setup quality

\u{1F3C6} <b>WINNING STRATEGY:</b> <i>Start small, scale up with success</i>

\u{1F4CA} <b>4. Portfolio Risk Management</b>

\u2022 Monitor correlations between pairs
\u2022 Max portfolio risk: 5-6% total
\u2022 Diversify across:
  \u21B3 Different timeframes
  \u21B3 Multiple strategies
  \u21B3 Uncorrelated assets

\u26A0\uFE0F <b>CRITICAL:</b> <i>Never risk your entire portfolio on correlated positions!</i>

\u{1F3AF} <b>5. Implementation Checklist</b>

<b>Before Trading:</b>
\u2713 Calculate max position size
\u2713 Set clear stop loss level
\u2713 Define profit targets
\u2713 Check correlations

<b>During Trading:</b>
\u2713 Monitor price action
\u2713 Follow your plan
\u2713 No emotional decisions

<b>After Trading:</b>
\u2713 Document everything
\u2713 Calculate R:R ratio
\u2713 Review performance
\u2713 Update journal

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501 Key Takeaways \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

\u{1F3AF} <b>Remember These Points:</b>

1\uFE0F\u20E3 Position sizing is <u>non-negotiable</u>
2\uFE0F\u20E3 Always know your max loss
3\uFE0F\u20E3 Keep detailed trading records
4\uFE0F\u20E3 Scale positions wisely
5\uFE0F\u20E3 Review and adjust regularly

\u2B50\uFE0F <b>GOLDEN RULE:</b> <i>Protection of capital comes first, profits second!</i>

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501 Action Steps \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

\u{1F4DD} <b>Your Next Steps:</b>

1. Calculate your per-trade risk limit
2. Create a position sizing spreadsheet
3. Start your trading journal today
4. Review your last 10 trades
5. Adjust your risk parameters

\u{1F393} <b>Final Thought:</b> <i>Success in ${topic} trading starts with mastering risk management. Start implementing these principles today!</i>

#Trading #RiskManagement #${topic} #TradingEducation

Remember: Professional traders focus on risk management first, profits second. Your primary goal should be capital preservation, which enables long-term participation in the markets.`,
    // Comprehensive Technical Analysis Guide
    `\u{1F4C8} Mastering Technical Analysis in ${topic} Trading

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
__name(fallbackText, "fallbackText");
function getUnsplashImageUrl(keywords) {
  const q = encodeURIComponent(keywords.join(","));
  return `https://source.unsplash.com/1600x900/?${q}`;
}
__name(getUnsplashImageUrl, "getUnsplashImageUrl");
async function postToTelegram(botToken, chatId, caption, imageUrl) {
  const endpoint = `${TELEGRAM_API_BASE}/bot${botToken}/sendPhoto`;
  const body = {
    chat_id: chatId,
    photo: imageUrl,
    caption,
    parse_mode: "HTML"
  };
  const res2 = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const txt = await res2.text();
  if (!res2.ok) {
    throw new Error(`Telegram API error: ${res2.status} ${txt}`);
  }
  return txt;
}
__name(postToTelegram, "postToTelegram");
async function buildAndSend(env) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
  const topic = ["crypto", "forex"][Math.floor(Math.random() * 2)];
  const prompt = `Write a short educational trading tip for ${topic} traders. Keep it actionable and friendly.`;
  let caption = "";
  if (env.OPENROUTER_API_KEY) {
    try {
      caption = await generateTextWithOpenRouter(prompt, env.OPENROUTER_API_KEY);
    } catch (err) {
      console.error("OpenRouter call failed:", err.message);
      caption = fallbackText(topic);
    }
  } else {
    caption = fallbackText(topic);
  }
  if (caption.length > 1e3) caption = caption.slice(0, 990) + "...";
  const imgUrl = getUnsplashImageUrl([topic, "trading", "finance"]);
  const sendResult = await postToTelegram(botToken, chatId, caption, imgUrl);
  return sendResult;
}
__name(buildAndSend, "buildAndSend");
var index_default = {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const res2 = await buildAndSend(env);
        console.log("Posted to Telegram:", res2);
      } catch (err) {
        console.error("Error in scheduled job:", err);
      }
    })());
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/" || path === "/index.html") {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trading Education Bot Control Panel</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
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
    <\/script>
</body>
</html>`;
      return new Response(html, {
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }
    if (path.startsWith("/api/")) {
      const adminToken = request.headers.get("Authorization")?.replace("Bearer ", "");
      if (!adminToken || adminToken !== env.ADMIN_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
      if (path === "/api/generate" && request.method === "POST") {
        try {
          const { subject, market, model } = await request.json();
          if (!subject || !market || !model) {
            return new Response(JSON.stringify({ error: "Missing required fields: subject, market, and model are required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
          }
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
          let content = "";
          if (env.OPENROUTER_API_KEY) {
            try {
              content = await generateTextWithOpenRouter(prompt, env.OPENROUTER_API_KEY);
              if (!content) {
                throw new Error("No content generated");
              }
              content = content.replace(/\n\s*\n/g, "\n\n").replace(/•/g, "\u2022").replace(/---/g, "\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n").replace(/\*(.*?)\*/g, "<b>$1</b>").replace(/_(.*?)_/g, "<i>$1</i>").replace(/~(.*?)~/g, "<u>$1</u>");
            } catch (aiError) {
              console.error("AI generation error:", aiError);
              content = fallbackText(market);
            }
          } else {
            content = fallbackText(market);
          }
          return new Response(JSON.stringify({ content }), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (error) {
          console.error("Generation error:", error);
          return new Response(JSON.stringify({
            error: "Failed to generate content: " + (error.message || "Unknown error")
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      if (path === "/api/post" && request.method === "POST") {
        try {
          const { content } = await request.json();
          const imgUrl = getUnsplashImageUrl(["trading", "finance"]);
          await postToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, content, imgUrl);
          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      return new Response("Not Found", { status: 404 });
    }
    return new Response("Not Found", { status: 404 });
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
