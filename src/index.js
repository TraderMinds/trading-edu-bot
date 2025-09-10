// Cloudflare Worker: scheduled hourly to post trading educational content to Telegram

// Environment vars expected:
// TELEGRAM_BOT_TOKEN - required
// TELEGRAM_CHAT_ID - required
// OPENROUTER_API_KEY - optional (if provided, worker will call OpenRouter for text generation)

const TELEGRAM_API_BASE = 'https://api.telegram.org';

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
    `Tip: Always define your risk per trade. For ${topic}, use a fixed % of your account and stick to it. Takeaway: risk management preserves capital.`,
    `Tip: Use trend alignment across timeframes when trading ${topic}. Align daily and 1-hour trends before entering. Takeaway: trade with the trend, not against it.`,
    `Tip: Combine price action with a momentum indicator for ${topic}. Let the indicator confirm, not dictate. Takeaway: confirmation reduces false signals.`
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
    return new Response('Trading edu bot worker — scheduled posts only.');
  }
};
