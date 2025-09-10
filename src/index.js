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
  // Best-effort compatible call with an OpenAI-like response shape.
  // If OpenRouter's API shape differs, update this function accordingly.
  const url = 'https://api.openrouter.ai/v1/chat/completions';
  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are an expert trading educator. Produce a short educational tip for traders in crypto and forex (approx 2-4 sentences) and add a 1-line actionable takeaway.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 250
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter text generation failed: ${res.status} ${txt}`);
  }

  const json = await res.json();
  // Try common response shapes
  if (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) {
    return json.choices[0].message.content.trim();
  }
  if (json.output) return String(json.output).trim();
  if (json.text) return String(json.text).trim();
  return JSON.stringify(json);
}

function fallbackText(topic) {
  const tips = [
    // Risk Management Tips
    `Tip: Always define your risk per trade. For ${topic}, use a fixed % of your account and stick to it. Takeaway: risk management preserves capital.`,
    `Tip: Never risk more than 1-2% of your capital on a single ${topic} trade. Small losses keep you in the game. Takeaway: small risks lead to long-term survival.`,
    `Tip: Set your stop loss before entering any ${topic} trade. Know your exit before your entry. Takeaway: planning prevents emotional decisions.`,
    
    // Technical Analysis Tips
    `Tip: Use trend alignment across timeframes when trading ${topic}. Align daily and 1-hour trends before entering. Takeaway: trade with the trend, not against it.`,
    `Tip: Combine price action with a momentum indicator for ${topic}. Let the indicator confirm, not dictate. Takeaway: confirmation reduces false signals.`,
    `Tip: Look for key support/resistance levels in ${topic} markets. These levels often lead to reversals or breakouts. Takeaway: respect market structure.`,
    
    // Psychology Tips
    `Tip: Keep a trading journal for your ${topic} trades. Document entries, exits, and emotions. Takeaway: self-awareness improves performance.`,
    `Tip: Don't chase ${topic} trades you've missed. There will always be another opportunity. Takeaway: patience beats FOMO.`,
    `Tip: After a losing streak in ${topic}, reduce your position size. Build back confidence gradually. Takeaway: protect your psychology.`,
    
    // Strategy Tips
    `Tip: In ${topic} trading, focus on high-probability setups only. Quality beats quantity every time. Takeaway: wait for the perfect setup.`,
    `Tip: Use multiple timeframe analysis for ${topic}. Higher timeframes show trend, lower timeframes show entry. Takeaway: context matters.`,
    `Tip: When trading ${topic}, always consider market correlation. Related markets can confirm or contradict your thesis. Takeaway: markets are connected.`,
    
    // Market Specific
    `Tip: In ${topic === 'crypto' ? 'crypto markets, watch Bitcoin dominance' : 'forex, monitor USD strength'}. It affects all other trades. Takeaway: follow the market leader.`,
    `Tip: For ${topic} trading, weekends can gap ${topic === 'crypto' ? 'significantly' : 'in major news'}. Plan your positions accordingly. Takeaway: manage weekend risk.`,
    `Tip: ${topic === 'crypto' ? 'Exchange security matters. Use reputable platforms and secure your keys.' : 'Forex pairs have personality. Learn their typical ranges and behaviors.'} Takeaway: know your market.`
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
  const body = {
    chat_id: chatId,
    photo: imageUrl,
    caption,
    parse_mode: 'HTML'
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`Telegram API error: ${res.status} ${txt}`);
  }
  return txt;
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
      const html = await fetch(new URL('./ui/index.html', import.meta.url)).then(res => res.text());
      return new Response(html, { headers: { 'Content-Type': 'text/html' } });
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
          const { subject, market, model } = await request.json();
          const prompt = `Write a short educational trading tip about ${subject} for ${market} traders. Keep it actionable and friendly.`;

          let content = '';
          if (env.OPENROUTER_API_KEY) {
            content = await generateTextWithOpenRouter(prompt, env.OPENROUTER_API_KEY);
          } else {
            content = fallbackText(market);
          }

          return new Response(JSON.stringify({ content }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      if (path === '/api/post' && request.method === 'POST') {
        try {
          const { content } = await request.json();
          const imgUrl = getUnsplashImageUrl(['trading', 'finance']);
          await postToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, content, imgUrl);
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

      // Return 404 for unknown API endpoints
      return new Response('Not Found', { status: 404 });
    }

    // Return 404 for unknown paths
    return new Response('Not Found', { status: 404 });
  }
};
