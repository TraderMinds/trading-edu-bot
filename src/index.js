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
      companyName: "Trade with AI Mind",
      telegramChannel: "@AITraderMind", 
      website: "trader-mind-ai.ct.ws/index.html",
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

async function addSubjectToQueue(env, subject, market = 'crypto', model = 'deepseek/deepseek-chat-v3.1:free') {
  const queue = await getSubjectsQueue(env);
  const newItem = {
    id: Date.now().toString(),
    subject: subject.trim(),
    market,
    model,
    addedAt: new Date().toISOString(),
    processed: false
  };
  queue.push(newItem);
  await saveSubjectsQueue(env, queue);
  return newItem;
}

async function bulkAddSubjectsToQueue(env, subjects, market = 'crypto', model = 'deepseek/deepseek-chat-v3.1:free') {
  const queue = await getSubjectsQueue(env);
  const results = { added: [], failed: [] };
  const timestamp = new Date().toISOString();
  
  // Get existing subjects for duplicate detection
  const existingSubjects = new Set(queue.map(item => 
    `${item.subject.trim().toLowerCase()}-${item.market.toLowerCase()}`
  ));
  
  let idCounter = Date.now();
  
  for (const subject of subjects) {
    const trimmedSubject = subject.trim();
    
    // Skip empty subjects
    if (!trimmedSubject) {
      results.failed.push({ subject, reason: 'Empty subject' });
      continue;
    }
    
    // Skip subjects that are too short (less than 3 characters)
    if (trimmedSubject.length < 3) {
      results.failed.push({ subject, reason: 'Subject too short (minimum 3 characters)' });
      continue;
    }
    
    // Skip subjects that are too long (more than 200 characters)
    if (trimmedSubject.length > 200) {
      results.failed.push({ subject, reason: 'Subject too long (maximum 200 characters)' });
      continue;
    }
    
    // Check for duplicates
    const subjectKey = `${trimmedSubject.toLowerCase()}-${market.toLowerCase()}`;
    if (existingSubjects.has(subjectKey)) {
      results.failed.push({ subject, reason: 'Duplicate subject' });
      continue;
    }
    
    // Add to queue and track as existing
    const newItem = {
      id: (idCounter++).toString(),
      subject: trimmedSubject,
      market,
      model,
      addedAt: timestamp,
      processed: false
    };
    
    queue.push(newItem);
    existingSubjects.add(subjectKey);
    results.added.push(newItem);
  }
  
  // Save all changes in one atomic operation
  if (results.added.length > 0) {
    await saveSubjectsQueue(env, queue);
  }
  
  return results;
}

async function getNextSubject(env) {
  const queue = await getSubjectsQueue(env);
  return queue.find(item => !item.processed) || null;
}

async function removeSubjectFromQueue(env, subjectId) {
  const queue = await getSubjectsQueue(env);
  const filteredQueue = queue.filter(item => item.id !== subjectId);
  await saveSubjectsQueue(env, filteredQueue);
}

async function updateQueueItem(env, subjectId, subject, market, model) {
  const queue = await getSubjectsQueue(env);
  const item = queue.find(q => q.id === subjectId);
  if (item) {
    item.subject = subject.trim();
    item.market = market || item.market;
    item.model = model || item.model || 'deepseek/deepseek-chat-v3.1:free';
    item.updatedAt = new Date().toISOString();
    await saveSubjectsQueue(env, queue);
  } else {
    throw new Error('Queue item not found');
  }
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

async function generateTextWithOpenRouter(prompt, apiKey, model = 'openai/gpt-oss-20b:free') {
  if (!apiKey) {
    throw new Error('OpenRouter API key is required');
  }

  const url = 'https://openrouter.ai/api/v1/chat/completions';
  console.warn('Generating content with OpenRouter:', {
    hasApiKey: !!apiKey,
    model: model,
    promptLength: prompt.length
  });

  const body = {
    model: model,
    messages: [
      { 
        role: 'system', 
        content: `You are an elite trading educator and financial analyst with 20+ years of experience across forex, cryptocurrency, and stock markets. Your mission is to create world-class educational content that transforms beginners into profitable, disciplined traders.

        🎯 TELEGRAM POST STRUCTURE (Follow this EXACT format):

        📱 HEADER SECTION:
        • Eye-catching title with relevant emojis (max 60 characters)
        • Quick stats or hook (1-2 lines)
        • Reading time estimate: ⏱️ 3-4 minutes

        🔥 HOOK SECTION:
        • Start with a compelling problem or surprising fact
        • Use statistics or real market examples
        • Create urgency or curiosity in 2-3 lines

        📚 MAIN CONTENT (3-4 focused sections):
        
        SECTION 1: Core Concept
        • Define the main topic clearly
        • Explain why it matters (2-3 bullet points)
        • Include 1 specific example with numbers
        
        SECTION 2: Practical Application 
        • Step-by-step implementation guide
        • Real trading scenarios with specific setups
        • Common mistakes to avoid
        
        SECTION 3: Advanced Tips
        • Pro-level insights and techniques  
        • Market psychology elements
        • Risk management integration
        
        [OPTIONAL] SECTION 4: Market Context
        • Current market conditions relevance
        • Upcoming events or catalysts
        • Adaptation strategies

        🎯 ACTION SECTION:
        • 3-5 immediately actionable steps
        • Specific tools or resources mentioned
        • Practice exercises or homework

        📈 CONCLUSION:
        • Key takeaway in one powerful sentence
        • Motivation or mindset advice
        • Call to action or next learning step

        � TELEGRAM OPTIMIZATION REQUIREMENTS:

        LENGTH & STRUCTURE:
        • Total length: 1800-2800 characters (Telegram caption limit)
        • Use short, punchy sentences (10-15 words max)
        • Break long concepts into digestible chunks
        • Each paragraph max 2-3 lines on mobile

        FORMATTING RULES:
        • ONLY use: <b>bold</b>, <i>italic</i>, <u>underline</u>, <code>code</code>
        • NEVER use: <ul>, <ol>, <li>, <p>, <h1-h6>, <br>, <div>, <span>
        • Use • for bullet points (never HTML lists)
        • Use 1., 2., 3. for numbered lists (never HTML)
        • Section dividers: ━━━━━━━━━━━━━━━━━━━━

        VISUAL HIERARCHY:
        • Main sections: 📊 <b>SECTION NAME</b>
        • Key concepts: <b>Bold for emphasis</b>
        • Tips: 💡 <i>Italicized insights</i>
        • Warnings: ⚠️ <u>Underlined critical points</u>
        • Code/formulas: <code>Technical terms</code>

        ENGAGEMENT ELEMENTS:
        • Strategic emoji usage (enhance, don't overwhelm)
        • Questions to reader: "Have you experienced this?"
        • Direct address: "Your next step is..."
        • Urgency: "Start this today" / "Don't wait until..."

        CONTENT QUALITY STANDARDS:

        SPECIFICITY:
        • Include exact numbers: "Risk 1-2% per trade" not "risk a small amount"
        • Name specific indicators: "RSI below 30" not "oversold conditions"  
        • Give precise timeframes: "15-minute chart" not "short timeframe"
        • Reference actual price levels when relevant

        ACTIONABILITY:
        • Every tip must be immediately implementable
        • Provide exact steps, not vague advice
        • Include tool recommendations when helpful
        • Give homework or practice exercises

        EDUCATIONAL DEPTH:
        • Explain the "why" behind each strategy
        • Connect concepts to market psychology
        • Show both theory and real-world application
        • Address different skill levels appropriately

        MARKET RELEVANCE:
        • Reference current market conditions when possible
        • Mention recent examples or case studies
        • Connect to trending topics or events
        • Show adaptability across market cycles

        🧠 EXPERT KNOWLEDGE AREAS:

        TECHNICAL ANALYSIS:
        • Chart patterns, candlestick analysis, indicator strategies
        • Multi-timeframe analysis, support/resistance dynamics
        • Volume analysis, market structure, trend identification

        RISK MANAGEMENT:
        • Position sizing formulas, stop-loss strategies
        • Portfolio theory, correlation analysis, drawdown management
        • Kelly criterion, risk-reward optimization

        TRADING PSYCHOLOGY:
        • Emotional control, discipline building, bias recognition
        • Performance psychology, stress management
        • Habit formation, mindset development

        MARKET DYNAMICS:
        • Order flow, institutional behavior, market microstructure
        • Economic indicators, central bank policy, global correlations
        • Volatility patterns, seasonal effects, market cycles

        🎯 SUCCESS METRICS:
        Your content should make readers think: "This is exactly what I needed to know" and "I can implement this right away."

        Focus on transformation, not just information. Build traders who think and act like professionals.`
      },
      { role: 'user', content: prompt }
    ],
    max_tokens: 3500, // Optimized for Telegram post length (was too high at 12000)
    temperature: 0.75, // Balanced creativity and consistency
    top_p: 0.85, // Focused coherence for educational content
    frequency_penalty: 0.3, // Reduce repetition significantly
    presence_penalty: 0.2 // Encourage topic diversity
  };

  console.warn('Making OpenRouter API request with body:', JSON.stringify(body));
  
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://trading-edu-bot-worker.tradermindai.workers.dev',
        'X-Title': 'Trading Education Bot',
        'X-Model': body.model
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    console.warn('OpenRouter API response status:', res.status);
    
    if (!res.ok) {
      const txt = await res.text();
      console.error('OpenRouter API error response:', txt);
      throw new Error(`API error (${res.status}): ${txt}`);
    }

    const json = await res.json();
    console.warn('OpenRouter API response:', JSON.stringify(json));
    
    // Handle OpenRouter response format
    if (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) {
      const content = json.choices[0].message.content.trim();
      console.warn('Generated content length:', content.length);
      return content;
    }
    
    // Try alternative response shapes
    if (json.output) {
      const content = String(json.output).trim();
      console.warn('Generated content length (output):', content.length);
      return content;
    }
    if (json.text) {
      const content = String(json.text).trim();
      console.warn('Generated content length (text):', content.length);
      return content;
    }
    
    // If no known response shape matches, log the response and throw error
    console.error('Unexpected API response shape:', JSON.stringify(json));
    throw new Error('Unexpected response format from OpenRouter API');
  } catch (error) {
    console.error('OpenRouter API error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: AI generation took too long (>30s)');
    } else if (error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to AI service');
    } else {
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }
}

// Sanitize content for Telegram HTML parsing
function sanitizeForTelegram(content) {
  if (!content) return '';
  
  console.warn('Sanitizing content for Telegram, original length:', content.length);
  
  // First, let's fix any obvious HTML issues and convert unsupported tags
  let sanitized = content
    // Convert <ul> and <ol> lists to bullet points
    .replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ul>/gi, '')
    .replace(/<ol[^>]*>/gi, '')
    .replace(/<\/ol>/gi, '')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    
    // Convert <h1-h6> headers to bold text
    .replace(/<h[1-6][^>]*>/gi, '\n<b>')
    .replace(/<\/h[1-6]>/gi, '</b>\n')
    
    // Convert <p> tags to line breaks
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    
    // Convert <br> tags to line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    
    // Convert <strong> to <b>
    .replace(/<strong[^>]*>/gi, '<b>')
    .replace(/<\/strong>/gi, '</b>')
    
    // Convert <em> to <i>
    .replace(/<em[^>]*>/gi, '<i>')
    .replace(/<\/em>/gi, '</i>')
    
    // Remove any other unsupported HTML tags while preserving content
    .replace(/<(?!\/?(b|i|u|s|code|pre|a\s)[^>]*>)[^>]+>/gi, '');

  // Fix unmatched HTML tags for Telegram-supported tags (b, i, u, code)
  sanitized = fixUnmatchedTags(sanitized);
    
  // Clean up multiple consecutive newlines
  sanitized = sanitized
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
  
  console.warn('Content sanitized for Telegram, new length:', sanitized.length);
  
  // Log any remaining potentially problematic tags for debugging
  const remainingTags = sanitized.match(/<[^>]+>/g);
  if (remainingTags) {
    console.warn('Remaining HTML tags after sanitization:', remainingTags);
  }
  
  return sanitized;
}

// Fix unmatched HTML tags to ensure proper opening/closing pairs
function fixUnmatchedTags(content) {
  // Supported tags in Telegram: b, i, u, code, s, pre, a
  const supportedTags = ['b', 'i', 'u', 'code', 's'];
  
  let fixed = content;
  
  // For each supported tag, ensure proper matching
  supportedTags.forEach(tag => {
    // Count opening and closing tags
    const openingMatches = fixed.match(new RegExp(`<${tag}\\b[^>]*>`, 'gi')) || [];
    const closingMatches = fixed.match(new RegExp(`</${tag}>`, 'gi')) || [];
    
    console.warn(`Tag ${tag}: ${openingMatches.length} opening, ${closingMatches.length} closing`);
    
    // If unmatched, remove the problematic tags
    if (openingMatches.length !== closingMatches.length) {
      console.warn(`Unmatched ${tag} tags detected, removing all ${tag} tags`);
      // Remove all instances of this tag to prevent parsing errors
      fixed = fixed
        .replace(new RegExp(`<${tag}\\b[^>]*>`, 'gi'), '')
        .replace(new RegExp(`</${tag}>`, 'gi'), '');
    }
  });
  
  return fixed;
}

function getUnsplashImageUrl(keywords) {
  // Use Unsplash Source to get a relevant free image. No API key required.
  // Example: https://source.unsplash.com/1600x900/?crypto,finance
  const q = encodeURIComponent(keywords.join(','));
  return `https://source.unsplash.com/1600x900/?${q}`;
}

// Validate image URL before sending to Telegram
async function validateImageUrl(imageUrl) {
  console.warn('Validating image URL:', imageUrl);
  
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    console.warn('Image validation result:', {
      status: response.status,
      contentType,
      contentLength,
      url: imageUrl
    });
    
    // Check if it's actually an image
    if (!contentType || !contentType.startsWith('image/')) {
      console.error('URL does not return an image. Content-Type:', contentType);
      return false;
    }
    
    // Check if image is too large (Telegram has limits)
    if (contentLength && parseInt(contentLength) > 20 * 1024 * 1024) { // 20MB limit
      console.error('Image too large:', contentLength);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating image URL:', error);
    return false;
  }
}

// Alternative image sources if Unsplash fails
function getBackupImageUrl() {
  const backupImages = [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&h=900&fit=crop&crop=center', // Trading chart
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1600&h=900&fit=crop&crop=center', // Financial data
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1600&h=900&fit=crop&crop=center', // Stock market
    'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=1600&h=900&fit=crop&crop=center', // Charts
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1600&h=900&fit=crop&crop=center'  // Finance
  ];
  
  return backupImages[Math.floor(Math.random() * backupImages.length)];
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

  console.warn('Starting two-step posting process: image first, then full content as reply');

  // Step 1: Send image with minimal caption
  let imageMessageId;
  try {
    // Image validation and backup selection
    let finalImageUrl = imageUrl;
    const isValidImage = await validateImageUrl(imageUrl);
    if (!isValidImage) {
      console.warn('Original image URL failed validation, using backup');
      finalImageUrl = getBackupImageUrl();
      
      // Validate backup image too
      const isBackupValid = await validateImageUrl(finalImageUrl);
      if (!isBackupValid) {
        console.warn('Backup image also failed, trying another backup');
        finalImageUrl = getBackupImageUrl();
      }
    }
    
    const photoEndpoint = `${TELEGRAM_API_BASE}/bot${botToken}/sendPhoto`;
    
    // Send image with minimal caption
    const imageBody = {
      chat_id: chatId,
      photo: finalImageUrl,
      caption: '📊 Trading Education', // Minimal caption
      parse_mode: 'HTML'
    };

    console.warn('Sending image:', {
      endpoint: photoEndpoint.replace(botToken, '[REDACTED]'),
      finalImageUrl: finalImageUrl?.substring(0, 50) + '...',
      chatId: chatId
    });

    const imageRes = await fetchWithRetry(photoEndpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'TradingBot/1.0'
      },
      body: JSON.stringify(imageBody)
    });

    const imageResText = await imageRes.text();
    
    if (!imageRes.ok) {
      console.error('Image posting failed:', imageResText);
      throw new Error(`Image posting failed: ${imageRes.status} - ${imageResText}`);
    }

    // Parse response to get message ID
    const imageResponseData = JSON.parse(imageResText);
    imageMessageId = imageResponseData.result.message_id;
    console.warn('Image posted successfully, message ID:', imageMessageId);

  } catch (imageError) {
    console.error('Image posting failed, falling back to text-only:', imageError.message);
    
    // If image fails, send full content as regular message
    try {
      const textEndpoint = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;
      const textOnlyBody = {
        chat_id: chatId,
        text: caption || 'Trading Education Content',
        parse_mode: 'HTML'
      };
      
      const textRes = await fetchWithRetry(textEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'TradingBot/1.0'
        },
        body: JSON.stringify(textOnlyBody)
      });
      
      const textResText = await textRes.text();
      if (textRes.ok) {
        console.warn('Text-only fallback successful');
        return textResText;
      } else {
        throw new Error(`Text fallback also failed: ${textRes.status} - ${textResText}`);
      }
    } catch (textError) {
      console.error('All posting methods failed:', textError.message);
      throw new Error(`Complete posting failure: ${imageError.message}, ${textError.message}`);
    }
  }

  // Step 2: Send full educational content as reply to the image
  try {
    const messageEndpoint = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;
    
    const replyBody = {
      chat_id: chatId,
      text: caption || 'Trading Education Content',
      parse_mode: 'HTML',
      reply_to_message_id: imageMessageId
    };

    console.warn('Sending full content as reply:', {
      endpoint: messageEndpoint.replace(botToken, '[REDACTED]'),
      contentLength: caption?.length,
      replyToMessageId: imageMessageId
    });

    const replyRes = await fetchWithRetry(messageEndpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'TradingBot/1.0'
      },
      body: JSON.stringify(replyBody)
    });

    const replyResText = await replyRes.text();
    
    if (!replyRes.ok) {
      console.error('Reply message failed:', replyResText);
      
      // Try sending without HTML if parsing fails
      console.warn('Attempting reply without HTML formatting');
      const plainTextBody = {
        chat_id: chatId,
        text: caption.replace(/<[^>]*>/g, '') || 'Trading Education Content',
        reply_to_message_id: imageMessageId
      };
      
      const plainRes = await fetchWithRetry(messageEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'TradingBot/1.0'
        },
        body: JSON.stringify(plainTextBody)
      });
      
      const plainResText = await plainRes.text();
      if (plainRes.ok) {
        console.warn('Plain text reply successful');
        return plainResText;
      } else {
        throw new Error(`Reply failed with HTML and plain text: ${replyResText}, ${plainResText}`);
      }
    }

    console.warn('Two-step posting completed successfully');
    return replyResText;

  } catch (replyError) {
    console.error('Reply message failed:', replyError.message);
    console.warn('Image was posted successfully, but reply failed');
    // Return success since image was posted, even if reply failed
    return `Image posted successfully (ID: ${imageMessageId}), but reply failed: ${replyError.message}`;
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
    console.warn('Processing queued subject:', nextSubject);
    topic = nextSubject.market;
    prompt = `Create an extensive, comprehensive educational guide about "${nextSubject.subject}" for ${nextSubject.market} traders. 

Include the following in your response:
📚 **Introduction & Definition**: Clear explanation of the concept
📖 **How it Works**: Step-by-step breakdown of the process
💡 **Key Strategies**: 3-4 practical strategies traders can use
⚠️ **Risk Management**: Important risks and how to mitigate them
📈 **Real-World Examples**: Concrete examples of application
🎯 **Action Steps**: What traders should do next
💪 **Pro Tips**: Advanced insights for better results

Format with HTML tags for Telegram (use <b></b> for bold, <i></i> for italics).
Aim for 2000-3000 characters to provide comprehensive educational value.
Make it detailed, informative, and highly actionable for serious traders.`;
  } else {
    // Fallback to random topics if queue is empty
    topic = ['crypto', 'forex'][Math.floor(Math.random() * 2)];
    prompt = `Write an extensive educational trading guide for ${topic} traders. 

Include the following sections:
📚 **Topic Overview**: Pick an important trading concept and explain it clearly
📖 **Core Principles**: How the concept works in practice
💡 **Trading Strategies**: 3-4 actionable strategies
⚠️ **Risk Management**: Key risks and mitigation techniques
📈 **Market Examples**: Real scenarios where this applies
🎯 **Implementation**: Step-by-step action plan
💪 **Advanced Tips**: Pro-level insights

Format with HTML tags for Telegram (use <b></b> for bold, <i></i> for italics).
Aim for 2000-3000 characters to provide comprehensive educational value.
Keep it highly actionable and professional for serious traders.`;
  }

  let caption = '';
  if (env.OPENROUTER_API_KEY) {
    try {
      // Use model from queue item or default for scheduled posts
      const scheduledModel = nextSubject?.model || 'deepseek/deepseek-chat-v3.1:free';
      console.warn('Using AI model for scheduled post:', scheduledModel);
      caption = await generateTextWithOpenRouter(prompt, env.OPENROUTER_API_KEY, scheduledModel);
    } catch (err) {
      // AI call failed - don't send anything
      console.error('OpenRouter call failed:', err.message);
      console.warn('No fallback content available - skipping post');
      throw new Error(`AI API not working: ${err.message}`);
    }
  } else {
    // No API key - don't send anything
    console.error('No OpenRouter API key configured');
    console.warn('No API key available - skipping post');
    throw new Error('OpenRouter API key not configured');
  }

  // Sanitize caption for Telegram
  caption = sanitizeForTelegram(caption);

  // Add footer to caption if enabled
  const footer = await getPostFooter(env);
  if (footer.enabled) {
    const footerText = `\n\n━━━━━━━━━━━━━━━━━━━━\n📈 <b>${footer.companyName || 'TradingBot Pro'}</b>\n📱 ${footer.telegramChannel || '@tradingbot'}\n🌐 ${footer.website || 'tradingbot.com'}\n\n#TradingEducation #${topic.charAt(0).toUpperCase() + topic.slice(1)}Trading\n\n<i>~ Your Trading Mentor</i> ✍️`;
    caption += footerText;
  }

  // Keep content within Telegram message limits (4096 characters for regular messages)
  // Since we're sending as a reply message, we can use the full 4096 character limit
  if (caption.length > 4000) {
    caption = caption.slice(0, 3900) + '...\n\n' + (footer.enabled ? `📈 <b>${footer.companyName || 'TradingBot Pro'}</b>\n\n<i>~ Your Trading Mentor</i> ✍️` : '');
  }

  // Compose image query keywords
  const imgUrl = getUnsplashImageUrl([topic, 'trading', 'finance']);

  console.warn('Final caption length:', caption.length);
  console.warn('Image URL:', imgUrl);

  const sendResult = await postToTelegram(botToken, chatId, caption, imgUrl);
  
  // Update posting statistics
  await updatePostingStats(env, true);
  
  // Mark subject as processed and remove from queue if it was from queue
  if (nextSubject) {
    await removeSubjectFromQueue(env, nextSubject.id);
    console.warn('Subject processed and removed from queue:', nextSubject.subject);
  }
  
  return sendResult;
}

export default {
  async scheduled(event, env, ctx) {
    // Use waitUntil so the scheduled event can finish asynchronously
    ctx.waitUntil((async () => {
      try {
        // Check if we should respect UI-configured schedule
        const storedSchedule = await env.SUBJECTS_QUEUE.get('schedule');
        
        // If a custom schedule is set in UI, validate if we should run now
        if (storedSchedule && storedSchedule !== '0 */1 * * *') {
          console.warn(`UI Schedule configured: ${storedSchedule}, but worker triggered by wrangler.toml cron`);
          console.warn(`Note: Update wrangler.toml crons = ["${storedSchedule}"] and redeploy for schedule to take effect`);
        }
        
        const res = await buildAndSend(env);
        console.warn('Posted to Telegram:', res);
      } catch (err) {
        console.error('Error in scheduled job:', err);
      }
    })());
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Public landing page (business site)
    if (path === '/' || path === '/index.html') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TradingBot Pro — AI-Powered Trading Education System | $500</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <meta name="description" content="Professional AI-powered trading education bot for Telegram. Automated content delivery, advanced scheduling, premium features. Transform your trading community today." />
  <style>
    body { font-family: 'Inter', sans-serif; }
    .hero-gradient { background: linear-gradient(135deg, #0f172a 0%, #1e293b 25%, #1e40af 75%, #3b82f6 100%); }
    .feature-card { transition: all 0.3s ease; }
    .feature-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .price-highlight { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
    .testimonial-card { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); }
    .cta-pulse { animation: pulse-glow 2s infinite; }
    @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.4); } 50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.8); } }
  </style>
</head>
<body class="bg-white">
  <!-- Navigation -->
  <nav class="fixed w-full bg-white/95 backdrop-blur-md z-50 border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <i class="fas fa-robot text-white text-lg"></i>
          </div>
          <span class="text-xl font-bold text-gray-900">TradingBot Pro</span>
        </div>
        <div class="hidden md:flex items-center space-x-8">
          <a href="#features" class="text-gray-600 hover:text-blue-600 font-medium">Features</a>
          <a href="#pricing" class="text-gray-600 hover:text-blue-600 font-medium">Pricing</a>
          <a href="#testimonials" class="text-gray-600 hover:text-blue-600 font-medium">Testimonials</a>
          <a href="#demo" class="text-gray-600 hover:text-blue-600 font-medium">Demo</a>
          <a href="https://t.me/AITradingBotProbot" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">Get Started</a>
        </div>
        <button class="md:hidden">
          <i class="fas fa-bars text-gray-600"></i>
        </button>
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="hero-gradient text-white pt-24 pb-16">
    <div class="max-w-7xl mx-auto px-6">
      <div class="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div class="inline-flex items-center bg-white/10 rounded-full px-4 py-2 mb-6">
            <span class="text-green-400 text-sm font-semibold">🚀 LAUNCH SPECIAL</span>
            <span class="text-white/80 text-sm ml-2">Limited Time Offer</span>
          </div>
          <h1 class="text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            Transform Your Trading Community with 
            <span class="bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">AI-Powered Education</span>
          </h1>
          <p class="text-xl text-blue-100 mb-8 leading-relaxed">
            Professional-grade trading education bot that delivers expert content, manages schedules, and grows your Telegram audience automatically. Used by top trading communities worldwide.
          </p>
          <div class="flex flex-col sm:flex-row gap-4">
            <a href="#pricing" class="cta-pulse bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg inline-flex items-center justify-center">
              <i class="fas fa-download mr-3"></i>
              Get TradingBot Pro - $500
            </a>
            <a href="#demo" class="border-2 border-white/30 hover:bg-white/10 text-white px-8 py-4 rounded-xl font-semibold inline-flex items-center justify-center">
              <i class="fas fa-play mr-3"></i>
              Watch Demo
            </a>
          </div>
          <div class="flex items-center mt-8 space-x-8 text-blue-200">
            <div class="flex items-center">
              <i class="fas fa-check-circle mr-2"></i>
              <span>Instant Setup</span>
            </div>
            <div class="flex items-center">
              <i class="fas fa-shield-alt mr-2"></i>
              <span>Enterprise Security</span>
            </div>
            <div class="flex items-center">
              <i class="fas fa-headset mr-2"></i>
              <span>24/7 Support</span>
            </div>
          </div>
        </div>
        <div class="relative">
          <div class="bg-white/10 rounded-2xl p-8 backdrop-blur-md">
            <div class="bg-gray-900 rounded-lg p-4 mb-4">
              <div class="flex items-center mb-3">
                <div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <div class="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                <div class="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span class="text-gray-400 text-sm ml-2">TradingBot Dashboard</span>
              </div>
              <div class="text-green-400 text-sm font-mono">
                ✅ Content Generated: "Risk Management in Crypto"<br/>
                ✅ Posted to @trading_channel (2.1k members)<br/>
                ✅ Next post scheduled: 15 minutes<br/>
                📈 Engagement rate: 94.2%
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-blue-500/20 rounded-lg p-4 text-center">
                <div class="text-2xl font-bold">2,847</div>
                <div class="text-sm text-blue-200">Posts Generated</div>
              </div>
              <div class="bg-green-500/20 rounded-lg p-4 text-center">
                <div class="text-2xl font-bold">98.7%</div>
                <div class="text-sm text-green-200">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Social Proof -->
  <section class="bg-gray-50 py-12">
    <div class="max-w-7xl mx-auto px-6 text-center">
      <p class="text-gray-600 mb-8">Trusted by leading trading communities worldwide</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-8 items-center opacity-60">
        <div class="text-2xl font-bold text-gray-400">CryptoTraders</div>
        <div class="text-2xl font-bold text-gray-400">ForexMasters</div>
        <div class="text-2xl font-bold text-gray-400">TradingAcademy</div>
        <div class="text-2xl font-bold text-gray-400">InvestorHub</div>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section id="features" class="py-20 bg-white">
    <div class="max-w-7xl mx-auto px-6">
      <div class="text-center mb-16">
        <h2 class="text-4xl font-bold text-gray-900 mb-4">Everything You Need to Dominate Trading Education</h2>
        <p class="text-xl text-gray-600 max-w-3xl mx-auto">Professional features designed for serious trading educators and community builders.</p>
      </div>
      
      <div class="grid md:grid-cols-3 gap-8 mb-16">
        <div class="feature-card bg-white rounded-2xl p-8 border border-gray-200">
          <div class="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
            <i class="fas fa-brain text-blue-600 text-2xl"></i>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-4">AI Content Engine</h3>
          <p class="text-gray-600 mb-4">Generate expert-level trading content with multiple AI models. From risk management to technical analysis, create engaging posts automatically.</p>
          <ul class="space-y-2 text-sm text-gray-500">
            <li>✓ 8+ Premium AI Models</li>
            <li>✓ Custom prompts & templates</li>
            <li>✓ Market-specific content</li>
            <li>✓ Telegram-optimized formatting</li>
          </ul>
        </div>

        <div class="feature-card bg-white rounded-2xl p-8 border border-gray-200">
          <div class="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6">
            <i class="fas fa-clock text-green-600 text-2xl"></i>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-4">Advanced Scheduling</h3>
          <p class="text-gray-600 mb-4">Minute-level precision scheduling with cron support. Set complex posting patterns that match your audience's activity.</p>
          <ul class="space-y-2 text-sm text-gray-500">
            <li>✓ Minute-level accuracy</li>
            <li>✓ Multiple time zones</li>
            <li>✓ Queue management</li>
            <li>✓ Auto-deployment sync</li>
          </ul>
        </div>

        <div class="feature-card bg-white rounded-2xl p-8 border border-gray-200">
          <div class="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
            <i class="fas fa-dashboard text-purple-600 text-2xl"></i>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-4">Professional Dashboard</h3>
          <p class="text-gray-600 mb-4">Comprehensive admin panel with analytics, content management, and real-time monitoring. Control everything from one place.</p>
          <ul class="space-y-2 text-sm text-gray-500">
            <li>✓ Real-time analytics</li>
            <li>✓ Content queue management</li>
            <li>✓ Performance tracking</li>
            <li>✓ Custom branding</li>
          </ul>
        </div>
      </div>

      <!-- Advanced Features Grid -->
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="bg-gray-50 rounded-xl p-6">
          <i class="fas fa-shield-alt text-blue-600 text-xl mb-3"></i>
          <h4 class="font-semibold mb-2">Enterprise Security</h4>
          <p class="text-sm text-gray-600">Token-based authentication, secure API endpoints, and encrypted data storage.</p>
        </div>
        <div class="bg-gray-50 rounded-xl p-6">
          <i class="fas fa-mobile-alt text-green-600 text-xl mb-3"></i>
          <h4 class="font-semibold mb-2">Mobile Optimized</h4>
          <p class="text-sm text-gray-600">Responsive design works perfectly on all devices. Manage on the go.</p>
        </div>
        <div class="bg-gray-50 rounded-xl p-6">
          <i class="fas fa-code text-purple-600 text-xl mb-3"></i>
          <h4 class="font-semibold mb-2">API Integration</h4>
          <p class="text-sm text-gray-600">RESTful APIs for custom integrations and third-party connections.</p>
        </div>
        <div class="bg-gray-50 rounded-xl p-6">
          <i class="fas fa-chart-line text-orange-600 text-xl mb-3"></i>
          <h4 class="font-semibold mb-2">Analytics & Insights</h4>
          <p class="text-sm text-gray-600">Track engagement, posting frequency, and community growth metrics.</p>
        </div>
        <div class="bg-gray-50 rounded-xl p-6">
          <i class="fas fa-cloud text-blue-600 text-xl mb-3"></i>
          <h4 class="font-semibold mb-2">Cloud Infrastructure</h4>
          <p class="text-sm text-gray-600">Powered by Cloudflare Workers. Global edge computing with 99.9% uptime.</p>
        </div>
        <div class="bg-gray-50 rounded-xl p-6">
          <i class="fas fa-users text-green-600 text-xl mb-3"></i>
          <h4 class="font-semibold mb-2">Community Building</h4>
          <p class="text-sm text-gray-600">Tools and features designed to grow and engage your trading community.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing Section -->
  <section id="pricing" class="py-20 bg-gray-50">
    <div class="max-w-4xl mx-auto px-6 text-center">
      <h2 class="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
      <p class="text-xl text-gray-600 mb-12">One-time purchase. Lifetime access. No monthly fees.</p>
      
      <div class="bg-white rounded-3xl p-8 lg:p-12 shadow-xl border-2 border-blue-200 relative">
        <div class="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span class="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold">BEST VALUE</span>
        </div>
        
        <div class="text-center mb-8">
          <h3 class="text-2xl font-bold text-gray-900 mb-2">TradingBot Pro</h3>
          <div class="mb-4">
            <span class="text-6xl font-bold text-gray-900">$500</span>
            <span class="text-xl text-gray-500 ml-2">one-time</span>
          </div>
          <p class="text-gray-600">Complete trading education automation system</p>
        </div>

        <div class="grid md:grid-cols-2 gap-6 mb-8">
          <div class="text-left">
            <h4 class="font-semibold mb-3">🤖 AI & Content</h4>
            <ul class="space-y-2 text-gray-600">
              <li>✓ 8+ Premium AI Models</li>
              <li>✓ Unlimited content generation</li>
              <li>✓ Custom templates</li>
              <li>✓ Telegram optimization</li>
            </ul>
          </div>
          <div class="text-left">
            <h4 class="font-semibold mb-3">⚡ Automation</h4>
            <ul class="space-y-2 text-gray-600">
              <li>✓ Advanced scheduling</li>
              <li>✓ Queue management</li>
              <li>✓ Auto-deployment</li>
              <li>✓ Real-time monitoring</li>
            </ul>
          </div>
          <div class="text-left">
            <h4 class="font-semibold mb-3">📊 Analytics</h4>
            <ul class="space-y-2 text-gray-600">
              <li>✓ Performance tracking</li>
              <li>✓ Engagement metrics</li>
              <li>✓ Growth analytics</li>
              <li>✓ Custom reports</li>
            </ul>
          </div>
          <div class="text-left">
            <h4 class="font-semibold mb-3">🚀 Enterprise</h4>
            <ul class="space-y-2 text-gray-600">
              <li>✓ Priority support</li>
              <li>✓ Custom integrations</li>
              <li>✓ White-label options</li>
              <li>✓ Lifetime updates</li>
            </ul>
          </div>
        </div>

        <a href="#contact" class="price-highlight text-white px-12 py-4 rounded-xl font-bold text-lg inline-flex items-center justify-center w-full mb-4">
          <i class="fas fa-download mr-3"></i>
          Purchase TradingBot Pro - $500
        </a>
        
        <div class="flex items-center justify-center text-sm text-gray-500 space-x-6">
          <span>✓ 30-day money-back guarantee</span>
          <span>✓ Instant delivery</span>
          <span>✓ Lifetime support</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Testimonials -->
  <section id="testimonials" class="py-20 bg-white">
    <div class="max-w-7xl mx-auto px-6">
      <div class="text-center mb-16">
        <h2 class="text-4xl font-bold text-gray-900 mb-4">What Trading Educators Say</h2>
        <p class="text-xl text-gray-600">Real results from real customers</p>
      </div>
      
      <div class="grid md:grid-cols-3 gap-8">
        <div class="testimonial-card rounded-2xl p-8">
          <div class="flex items-center mb-4">
            <div class="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-4">MJ</div>
            <div>
              <h4 class="font-semibold">Michael Johnson</h4>
              <p class="text-sm text-gray-600">@CryptoMasterClass (15K members)</p>
            </div>
          </div>
          <p class="text-gray-700 mb-4">"TradingBot Pro revolutionized our Telegram channel. We went from manual posting to fully automated, professional content. Our engagement increased by 340% in just 2 months."</p>
          <div class="flex text-yellow-400">
            <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
          </div>
        </div>

        <div class="testimonial-card rounded-2xl p-8">
          <div class="flex items-center mb-4">
            <div class="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold mr-4">SR</div>
            <div>
              <h4 class="font-semibold">Sarah Rodriguez</h4>
              <p class="text-sm text-gray-600">@ForexTradeHub (8.2K members)</p>
            </div>
          </div>
          <p class="text-gray-700 mb-4">"The AI content quality is incredible. It generates expert-level educational content that would take me hours to write. Worth every penny of the $500 investment."</p>
          <div class="flex text-yellow-400">
            <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
          </div>
        </div>

        <div class="testimonial-card rounded-2xl p-8">
          <div class="flex items-center mb-4">
            <div class="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold mr-4">DK</div>
            <div>
              <h4 class="font-semibold">David Kim</h4>
              <p class="text-sm text-gray-600">@TechnicalTraders (22K members)</p>
            </div>
          </div>
          <p class="text-gray-700 mb-4">"Setup was incredibly easy. Within 30 minutes we had professional content posting automatically. The scheduling features are exactly what we needed for our global audience."</p>
          <div class="flex text-yellow-400">
            <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Demo Section -->
  <section id="demo" class="py-20 bg-gray-900 text-white">
    <div class="max-w-4xl mx-auto px-6 text-center">
      <h2 class="text-4xl font-bold mb-4">See TradingBot Pro in Action</h2>
      <p class="text-xl text-gray-300 mb-12">Watch how easy it is to set up and manage your trading education content</p>
      
      <div class="bg-gray-800 rounded-2xl p-8 relative">
        <div class="aspect-video bg-gray-700 rounded-xl flex items-center justify-center mb-6">
          <div class="text-center">
            <i class="fas fa-play-circle text-6xl text-blue-400 mb-4"></i>
            <p class="text-gray-300">Demo Video Coming Soon</p>
          </div>
        </div>
        
        <div class="grid md:grid-cols-3 gap-6 text-left">
          <div>
            <h4 class="font-semibold mb-2">⚡ Quick Setup</h4>
            <p class="text-sm text-gray-400">Install and configure in under 10 minutes</p>
          </div>
          <div>
            <h4 class="font-semibold mb-2">🎯 Content Creation</h4>
            <p class="text-sm text-gray-400">Generate professional trading content instantly</p>
          </div>
          <div>
            <h4 class="font-semibold mb-2">📊 Analytics Dashboard</h4>
            <p class="text-sm text-gray-400">Monitor performance and optimize engagement</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section id="contact" class="py-20 bg-blue-600 text-white">
    <div class="max-w-4xl mx-auto px-6 text-center">
      <h2 class="text-4xl font-bold mb-4">Ready to Transform Your Trading Community?</h2>
      <p class="text-xl text-blue-100 mb-8">Join hundreds of successful trading educators using TradingBot Pro</p>
      
      <div class="bg-white/10 rounded-2xl p-8 mb-8">
        <div class="grid md:grid-cols-3 gap-6 text-center">
          <div>
            <div class="text-3xl font-bold mb-2">500+</div>
            <div class="text-blue-200">Active Communities</div>
          </div>
          <div>
            <div class="text-3xl font-bold mb-2">2.1M+</div>
            <div class="text-blue-200">Posts Generated</div>
          </div>
          <div>
            <div class="text-3xl font-bold mb-2">98.7%</div>
            <div class="text-blue-200">Customer Satisfaction</div>
          </div>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="https://t.me/AITradingBotProbot" class="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg inline-flex items-center">
          <i class="fab fa-telegram mr-3"></i>
          Contact Sales - Get TradingBot Pro
        </a>
        <a href="/admin" class="border-2 border-white/30 hover:bg-white/10 text-white px-8 py-4 rounded-xl font-semibold inline-flex items-center">
          <i class="fas fa-cog mr-3"></i>
          Admin Demo
        </a>
      </div>
      
      <p class="text-blue-200 mt-6">Questions? Contact us at support@tradingbotpro.com</p>
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-gray-900 text-gray-400 py-12">
    <div class="max-w-7xl mx-auto px-6">
      <div class="grid md:grid-cols-4 gap-8">
        <div>
          <div class="flex items-center space-x-2 mb-4">
            <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <i class="fas fa-robot text-white"></i>
            </div>
            <span class="text-xl font-bold text-white">TradingBot Pro</span>
          </div>
          <p class="text-sm">Professional trading education automation for Telegram communities.</p>
        </div>
        <div>
          <h4 class="font-semibold text-white mb-4">Product</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="#features" class="hover:text-white">Features</a></li>
            <li><a href="#pricing" class="hover:text-white">Pricing</a></li>
            <li><a href="#demo" class="hover:text-white">Demo</a></li>
            <li><a href="/admin" class="hover:text-white">Admin Panel</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-semibold text-white mb-4">Support</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="#" class="hover:text-white">Documentation</a></li>
            <li><a href="#" class="hover:text-white">API Reference</a></li>
            <li><a href="#" class="hover:text-white">Help Center</a></li>
            <li><a href="#contact" class="hover:text-white">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-semibold text-white mb-4">Connect</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="#" class="hover:text-white">Telegram</a></li>
            <li><a href="#" class="hover:text-white">Twitter</a></li>
            <li><a href="#" class="hover:text-white">LinkedIn</a></li>
            <li><a href="#" class="hover:text-white">GitHub</a></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
        <p>&copy; <span id="year"></span> TradingBot Pro. All rights reserved. | Professional trading education automation system.</p>
      </div>
    </div>
  </footer>

  <script>
    document.getElementById('year').textContent = new Date().getFullYear();
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  </script>
</body>
</html>`;
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=900'
        }
      });
    }

  // Serve Admin UI
  if (path === '/admin') {
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
                            <!-- Default Model Selection -->
                            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <h4 class="text-sm font-medium text-blue-800 mb-3 flex items-center">
                                    <i class="fas fa-brain mr-2"></i>Default AI Model for Queue Posts
                                </h4>
                                <select id="defaultQueueModel" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500">
                                    <optgroup label="🆓 Free Models">
                                        <option value="openai/gpt-oss-120b:free">⚡ GPT OSS 120B - Most Powerful</option>
                                        <option value="deepseek/deepseek-chat-v3.1:free" selected>🧠 DeepSeek V3.1 - Advanced Reasoning</option>
                                        <option value="nvidia/nemotron-nano-9b-v2:free">🔥 NVIDIA Nemotron Nano 9B V2 - Latest</option>
                                        <option value="openai/gpt-oss-20b:free">🚀 GPT OSS 20B - Fast & Reliable</option>
                                        <option value="z-ai/glm-4.5-air:free">💨 GLM 4.5 Air - Efficient</option>
                                        <option value="qwen/qwen3-coder:free">💻 Qwen3 Coder - Code-Optimized</option>
                                    </optgroup>
                                    <optgroup label="🌟 Premium Models">
                                        <option value="openrouter/sonoma-sky-alpha">☁️ Sonoma Sky Alpha - Creative</option>
                                        <option value="openrouter/sonoma-dusk-alpha">🌅 Sonoma Dusk Alpha - Balanced</option>
                                    </optgroup>
                                </select>
                                <p class="text-xs text-blue-600 mt-2">💡 This model will be used for all new queue posts by default</p>
                            </div>
                            
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
                                    <optgroup label="🆓 Free Models">
                                        <option value="openai/gpt-oss-120b:free">⚡ GPT OSS 120B - Most Powerful</option>
                                        <option value="deepseek/deepseek-chat-v3.1:free">🧠 DeepSeek V3.1 - Advanced Reasoning</option>
                                        <option value="nvidia/nemotron-nano-9b-v2:free">🔥 NVIDIA Nemotron Nano 9B V2 - Latest</option>
                                        <option value="openai/gpt-oss-20b:free" selected>🚀 GPT OSS 20B - Fast & Reliable</option>
                                        <option value="z-ai/glm-4.5-air:free">💨 GLM 4.5 Air - Efficient</option>
                                        <option value="qwen/qwen3-coder:free">💻 Qwen3 Coder - Code-Optimized</option>
                                    </optgroup>
                                    <optgroup label="🌟 Premium Models">
                                        <option value="openrouter/sonoma-sky-alpha">☁️ Sonoma Sky Alpha - Creative</option>
                                        <option value="openrouter/sonoma-dusk-alpha">🌅 Sonoma Dusk Alpha - Balanced</option>
                                    </optgroup>
                                </select>
                                <p class="text-xs text-gray-500 mt-1">💡 Free models have usage limits. Premium models require credits.</p>
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
                                    <!-- Minute-based schedules -->
                                    <option value="*/5 * * * *">⚡ Every 5 minutes</option>
                                    <option value="*/10 * * * *">⚡ Every 10 minutes</option>
                                    <option value="*/15 * * * *">⚡ Every 15 minutes</option>
                                    <option value="*/20 * * * *">⚡ Every 20 minutes</option>
                                    <option value="*/30 * * * *">⚡ Every 30 minutes</option>
                                    <option value="0,30 * * * *">⚡ Every 30 minutes (on the hour)</option>
                                    
                                    <!-- Hourly schedules -->
                                    <option value="0 * * * *" selected>🕐 Every hour</option>
                                    <option value="0 */2 * * *">🕐 Every 2 hours</option>
                                    <option value="0 */4 * * *">🕓 Every 4 hours</option>
                                    <option value="0 */6 * * *">🕕 Every 6 hours</option>
                                    <option value="0 */12 * * *">🌓 Every 12 hours</option>
                                    
                                    <!-- Daily schedules -->
                                    <option value="0 0 * * *">🌅 Once per day (midnight)</option>
                                    <option value="0 9 * * *">🌅 Daily at 9:00 AM</option>
                                    <option value="0 12 * * *">🌅 Daily at 12:00 PM</option>
                                    <option value="0 18 * * *">🌅 Daily at 6:00 PM</option>
                                    
                                    <!-- Weekly schedules -->
                                    <option value="0 0 * * 1">📅 Weekly (Monday)</option>
                                    <option value="0 9 * * 1">📅 Weekly (Monday 9 AM)</option>
                                </select>
                                <div class="mt-2 text-sm text-gray-600">
                                    <p><i class="fas fa-info-circle mr-1 text-blue-500"></i> 
                                    <strong>Minute-based schedules</strong> provide high-frequency posting for active engagement.</p>
                                    <p class="mt-1"><i class="fas fa-exclamation-triangle mr-1 text-amber-500"></i> 
                                    <strong>Note:</strong> To fully apply schedule changes, update wrangler.toml and redeploy.</p>
                                </div>
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

        <!-- Edit Queue Item Modal -->
        <div id="editModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center hidden">
            <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-bold text-gray-800">Edit Queue Item</h3>
                    <button id="closeEditModal" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="space-y-4">
                    <input type="hidden" id="editItemId">
                    
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-700">Subject</label>
                        <input type="text" id="editItemSubject" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500" 
                               placeholder="Enter subject">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-2 text-gray-700">Market</label>
                            <select id="editItemMarket" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500">
                                <option value="crypto">📈 Cryptocurrency</option>
                                <option value="forex">💱 Forex</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium mb-2 text-gray-700">AI Model</label>
                            <select id="editItemModel" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500">
                                <optgroup label="🆓 Free Models">
                                    <option value="openai/gpt-oss-120b:free">⚡ GPT OSS 120B</option>
                                    <option value="deepseek/deepseek-chat-v3.1:free">🧠 DeepSeek V3.1</option>
                                    <option value="nvidia/nemotron-nano-9b-v2:free">🔥 NVIDIA Nemotron Nano</option>
                                    <option value="openai/gpt-oss-20b:free">🚀 GPT OSS 20B</option>
                                    <option value="z-ai/glm-4.5-air:free">💨 GLM 4.5 Air</option>
                                    <option value="qwen/qwen3-coder:free">💻 Qwen3 Coder</option>
                                </optgroup>
                                <optgroup label="🌟 Premium Models">
                                    <option value="openrouter/sonoma-sky-alpha">☁️ Sonoma Sky Alpha</option>
                                    <option value="openrouter/sonoma-dusk-alpha">🌅 Sonoma Dusk Alpha</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex space-x-3">
                        <button id="cancelEdit" class="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">
                            Cancel
                        </button>
                        <button id="confirmEdit" class="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                            Update Item
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
                loadSchedule(),
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

        async function loadSchedule() {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            try {
                const response = await fetch(\`\${API_BASE}/schedule\`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (response.ok) {
                    const data = await response.json();
                    document.getElementById('schedule').value = data.schedule || '0 * * * *';
                    
                    // Show schedule deployment status
                    updateScheduleStatus(data);
                } else {
                    document.getElementById('schedule').value = '0 * * * *';
                }
            } catch (error) {
                console.error('Failed to load schedule:', error);
                // Set default if loading fails
                document.getElementById('schedule').value = '0 * * * *';
            }
            
            // Calculate next post time after loading schedule
            calculateNextPost();
        }

        function updateScheduleStatus(data) {
            // Create or update schedule status indicator
            let statusElement = document.querySelector('.schedule-status');
            if (!statusElement) {
                statusElement = document.createElement('div');
                statusElement.className = 'schedule-status';
                statusElement.style.cssText = 'margin-top: 8px; font-size: 12px; padding: 8px; border-radius: 4px;';
                
                const scheduleContainer = document.getElementById('schedule').parentElement;
                scheduleContainer.appendChild(statusElement);
            }
            
            if (data.status === 'applied') {
                statusElement.innerHTML = \`
                    <div style="color: #28a745; background: #d4edda; padding: 6px; border-radius: 4px;">
                        ✅ <strong>Active:</strong> Schedule is deployed and running
                    </div>
                \`;
            } else if (data.status === 'pending_deployment') {
                statusElement.innerHTML = \`
                    <div style="color: #856404; background: #fff3cd; padding: 6px; border-radius: 4px;">
                        ⚠️ <strong>Pending:</strong> Schedule updated but needs deployment
                        <br><small>Commands: <code>npm run update-schedule "\${data.schedule}" && npm run deploy</code></small>
                    </div>
                \`;
            } else {
                statusElement.innerHTML = \`
                    <div style="color: #6c757d; background: #f8f9fa; padding: 6px; border-radius: 4px;">
                        ℹ️ <strong>Default:</strong> Using standard schedule
                    </div>
                \`;
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
                
                const data = await response.json();
                
                // Show detailed status with deployment instructions
                if (data.status === 'pending_deployment') {
                    showStatus(\`📅 Schedule updated in memory! Now needs deployment to activate.\`, 'warning');
                    
                    // Create detailed instructions popup
                    const instructionsHtml = \`
                        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 10px 0; border-radius: 8px;">
                            <h4>⚠️ Deployment Required</h4>
                            <p><strong>Current:</strong> \${data.currentSchedule}</p>
                            <p><strong>New:</strong> \${data.newSchedule}</p>
                            <p><strong>Status:</strong> Pending deployment</p>
                            
                            <h5>Quick Deploy Commands:</h5>
                            <div style="background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 4px; font-family: monospace;">
                                \${data.quickCommands.map(cmd => \`<div>\${cmd}</div>\`).join('')}
                            </div>
                            
                            <p><small>After deployment, refresh this page to see "Applied" status.</small></p>
                        </div>
                    \`;
                    
                    // Show in status area
                    document.getElementById('status').innerHTML = instructionsHtml;
                } else {
                    showStatus(\`✅ Schedule updated and active!\`, 'success');
                }
                
                // Recalculate next post time
                calculateNextPost();
                
                // Update schedule status display
                updateScheduleStatus(data);
                
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
                <div class="p-4 bg-gray-50 rounded-lg border hover:shadow-sm transition-shadow card-hover">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center space-x-2">
                            <span class="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                                #\${index + 1}
                            </span>
                            <span class="font-medium text-gray-800">\${item.subject}</span>
                        </div>
                        <div class="flex space-x-2">
                            <button onclick="editQueueItem('\${item.id}')" 
                                    class="bg-green-500 text-white p-2 rounded hover:bg-green-600 transition-colors"
                                    title="Edit model">
                                <i class="fas fa-edit text-xs"></i>
                            </button>
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
                    
                    <div class="flex items-center justify-between text-sm text-gray-500">
                        <div class="flex items-center space-x-3">
                            <span class="flex items-center">
                                <i class="fas fa-chart-line mr-1"></i>
                                \${item.market.charAt(0).toUpperCase() + item.market.slice(1)}
                            </span>
                            <span class="flex items-center">
                                <i class="fas fa-clock mr-1"></i>
                                \${new Date(item.addedAt).toLocaleDateString()}
                            </span>
                        </div>
                        <div class="flex items-center">
                            <i class="fas fa-brain mr-1 text-purple-500"></i>
                            <span class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-mono">
                                \${getModelDisplayName(item.model || 'deepseek/deepseek-chat-v3.1:free')}
                            </span>
                        </div>
                    </div>
                </div>
            \`).join('');
        }

        async function addSubject() {
            const subject = document.getElementById('newSubject').value.trim();
            const market = document.getElementById('newSubjectMarket').value;
            const model = document.getElementById('defaultQueueModel').value;
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
                    body: JSON.stringify({ subject, market, model })
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
            const model = document.getElementById('defaultQueueModel').value;
            const token = localStorage.getItem('adminToken');
            
            if (!token) return;
            if (subjects.length === 0) {
                showNotification('Please enter at least one subject', 'warning');
                return;
            }

            try {
                showLoading(true);
                
                // Use bulk add endpoint for atomic operation
                const response = await fetch(\`\${API_BASE}/queue\`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ subjects, market, model })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to add subjects');
                }

                const result = await response.json();
                
                document.getElementById('bulkSubjects').value = '';
                document.getElementById('bulkModal').classList.add('hidden');
                
                // Show detailed results
                let message = \`Successfully added \${result.added} of \${result.total} subjects!\`;
                
                if (result.failed && result.failed.length > 0) {
                    message += \`\\n\${result.failed.length} subjects were skipped:\`;
                    
                    // Group failures by reason
                    const failuresByReason = {};
                    result.failed.forEach(failure => {
                        if (!failuresByReason[failure.reason]) {
                            failuresByReason[failure.reason] = [];
                        }
                        failuresByReason[failure.reason].push(failure.subject);
                    });
                    
                    // Add detailed breakdown
                    for (const [reason, subjects] of Object.entries(failuresByReason)) {
                        message += \`\\n- \${reason}: \${subjects.length} subjects\`;
                    }
                    
                    // Log full details to console for debugging
                    console.warn('Bulk add failures:', result.failed);
                }
                
                showNotification(message, result.added > 0 ? 'success' : 'warning');
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

        function getModelDisplayName(modelId) {
            const modelNames = {
                'openai/gpt-oss-120b:free': 'GPT OSS 120B',
                'deepseek/deepseek-chat-v3.1:free': 'DeepSeek V3.1',
                'nvidia/nemotron-nano-9b-v2:free': 'Nemotron Nano',
                'openai/gpt-oss-20b:free': 'GPT OSS 20B',
                'z-ai/glm-4.5-air:free': 'GLM 4.5 Air',
                'qwen/qwen3-coder:free': 'Qwen3 Coder',
                'openrouter/sonoma-sky-alpha': 'Sonoma Sky',
                'openrouter/sonoma-dusk-alpha': 'Sonoma Dusk'
            };
            return modelNames[modelId] || modelId.split('/').pop().split(':')[0];
        }

        function calculateNextPost() {
            const schedule = document.getElementById('schedule').value;
            const nextElement = document.getElementById('nextPost');
            
            const now = new Date();
            let next = new Date(now);
            
            // Parse cron expression and calculate next execution time
            switch(schedule) {
                // Minute-based schedules
                case '*/5 * * * *':
                    next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5, 0, 0);
                    break;
                case '*/10 * * * *':
                    next.setMinutes(Math.ceil(next.getMinutes() / 10) * 10, 0, 0);
                    break;
                case '*/15 * * * *':
                    next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15, 0, 0);
                    break;
                case '*/20 * * * *':
                    next.setMinutes(Math.ceil(next.getMinutes() / 20) * 20, 0, 0);
                    break;
                case '*/30 * * * *':
                    next.setMinutes(Math.ceil(next.getMinutes() / 30) * 30, 0, 0);
                    break;
                case '0,30 * * * *':
                    if (next.getMinutes() < 30) {
                        next.setMinutes(30, 0, 0);
                    } else {
                        next.setHours(next.getHours() + 1, 0, 0, 0);
                    }
                    break;
                    
                // Hourly schedules
                case '0 * * * *':
                    next.setHours(next.getHours() + 1, 0, 0, 0);
                    break;
                case '0 */2 * * *':
                    next.setHours(Math.ceil(next.getHours() / 2) * 2, 0, 0, 0);
                    break;
                case '0 */4 * * *':
                    next.setHours(Math.ceil(next.getHours() / 4) * 4, 0, 0, 0);
                    break;
                case '0 */6 * * *':
                    next.setHours(Math.ceil(next.getHours() / 6) * 6, 0, 0, 0);
                    break;
                case '0 */12 * * *':
                    next.setHours(Math.ceil(next.getHours() / 12) * 12, 0, 0, 0);
                    break;
                    
                // Daily schedules
                case '0 0 * * *':
                    next.setDate(next.getDate() + 1);
                    next.setHours(0, 0, 0, 0);
                    break;
                case '0 9 * * *':
                    if (next.getHours() >= 9) {
                        next.setDate(next.getDate() + 1);
                    }
                    next.setHours(9, 0, 0, 0);
                    break;
                case '0 12 * * *':
                    if (next.getHours() >= 12) {
                        next.setDate(next.getDate() + 1);
                    }
                    next.setHours(12, 0, 0, 0);
                    break;
                case '0 18 * * *':
                    if (next.getHours() >= 18) {
                        next.setDate(next.getDate() + 1);
                    }
                    next.setHours(18, 0, 0, 0);
                    break;
                    
                // Weekly schedules
                case '0 0 * * 1':
                case '0 9 * * 1':
                    const targetDay = 1; // Monday
                    const currentDay = next.getDay();
                    let daysUntilMonday = (targetDay - currentDay + 7) % 7;
                    if (daysUntilMonday === 0 && (schedule === '0 0 * * 1' ? next.getHours() >= 0 : next.getHours() >= 9)) {
                        daysUntilMonday = 7;
                    }
                    next.setDate(next.getDate() + daysUntilMonday);
                    next.setHours(schedule === '0 9 * * 1' ? 9 : 0, 0, 0, 0);
                    break;
                    
                default:
                    // Fallback to hourly
                    next.setHours(next.getHours() + 1, 0, 0, 0);
            }
            
            const timeUntil = next - now;
            const hours = Math.floor(timeUntil / (1000 * 60 * 60));
            const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
            
            let timeString = next.toLocaleString();
            if (hours === 0 && minutes < 60) {
                timeString += \` (in \${minutes}m)\`;
            } else if (hours < 24) {
                timeString += \` (in \${hours}h \${minutes}m)\`;
            }
            
            nextElement.textContent = timeString;
        }

        async function editQueueItem(itemId) {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            try {
                // Get current queue to find the item
                const response = await fetch(\`\${API_BASE}/queue\`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (!response.ok) throw new Error('Failed to load queue');

                const data = await response.json();
                const item = data.queue.find(q => q.id === itemId);
                
                if (!item) {
                    showNotification('Queue item not found', 'error');
                    return;
                }

                // Show edit modal
                document.getElementById('editItemId').value = itemId;
                document.getElementById('editItemSubject').value = item.subject;
                document.getElementById('editItemMarket').value = item.market;
                document.getElementById('editItemModel').value = item.model || 'deepseek/deepseek-chat-v3.1:free';
                document.getElementById('editModal').classList.remove('hidden');
                
            } catch (error) {
                showNotification(\`Failed to load item details: \${error.message}\`, 'error');
            }
        }

        async function updateQueueItem() {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            const itemId = document.getElementById('editItemId').value;
            const subject = document.getElementById('editItemSubject').value.trim();
            const market = document.getElementById('editItemMarket').value;
            const model = document.getElementById('editItemModel').value;

            if (!subject) {
                showNotification('Subject cannot be empty', 'warning');
                return;
            }

            try {
                showLoading(true);
                const response = await fetch(\`\${API_BASE}/queue/\${itemId}\`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ subject, market, model })
                });

                if (!response.ok) throw new Error('Failed to update queue item');

                document.getElementById('editModal').classList.add('hidden');
                showNotification('Queue item updated successfully!', 'success');
                await loadQueue();
            } catch (error) {
                showNotification(\`Failed to update item: \${error.message}\`, 'error');
            } finally {
                showLoading(false);
            }
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
        document.getElementById('schedule').addEventListener('change', calculateNextPost);
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

        // Edit operations
        document.getElementById('closeEditModal').addEventListener('click', () => {
            document.getElementById('editModal').classList.add('hidden');
        });
        document.getElementById('cancelEdit').addEventListener('click', () => {
            document.getElementById('editModal').classList.add('hidden');
        });
        document.getElementById('confirmEdit').addEventListener('click', updateQueueItem);

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

        // Close modals when clicking outside
        document.getElementById('bulkModal').addEventListener('click', (e) => {
            if (e.target.id === 'bulkModal') {
                document.getElementById('bulkModal').classList.add('hidden');
            }
        });

        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal') {
                document.getElementById('editModal').classList.add('hidden');
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

          // Generate comprehensive prompt based on subject and market
          const prompt = `Create an expert-level educational guide about "${subject}" specifically for ${market} trading.

🎯 TOPIC FOCUS: ${subject}
💹 MARKET: ${market.charAt(0).toUpperCase() + market.slice(1)}
📊 TARGET AUDIENCE: Intermediate to advanced traders seeking actionable insights

📝 CONTENT REQUIREMENTS:
• Provide deep, actionable insights about ${subject}
• Include ${market}-specific examples and scenarios
• Cover both theoretical concepts and practical implementation
• Address common pitfalls and how to avoid them
• Include specific metrics, timeframes, and risk parameters
• Reference current market dynamics where relevant

🎨 STRUCTURE GUIDELINES:
1. Compelling title with problem/solution angle
2. Quick value proposition (why this matters now)
3. Core concept breakdown with examples
4. ${market.charAt(0).toUpperCase() + market.slice(1)}-specific applications
5. Implementation roadmap with specific steps
6. Risk management considerations
7. Advanced tips from professional perspective
8. Actionable next steps

💡 MAKE IT PRACTICAL:
- Include specific numbers and percentages
- Provide exact timeframes and conditions
- Give real trading scenarios
- Mention specific tools and indicators relevant to ${market}
- Address psychological aspects of implementing ${subject}

Remember: This should be professional-grade content that traders can immediately apply to improve their ${market} trading results.`;

          let content = '';
          if (env.OPENROUTER_API_KEY) {
            try {
              content = await generateTextWithOpenRouter(prompt, env.OPENROUTER_API_KEY, model);
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
              
              // Sanitize for Telegram HTML parsing
              content = sanitizeForTelegram(content);
            } catch (aiError) {
              console.error('AI generation error:', aiError);
              // No fallback - return error
              return new Response(JSON.stringify({ 
                error: 'AI API not working: ' + (aiError.message || 'Unknown error')
              }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          } else {
            // No API key - return error
            return new Response(JSON.stringify({ 
              error: 'OpenRouter API key not configured' 
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
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

          console.warn('Manual post attempt...', {
            contentLength: content.length,
            hasToken: !!env.TELEGRAM_BOT_TOKEN,
            hasChatId: !!env.TELEGRAM_CHAT_ID,
            tokenPrefix: env.TELEGRAM_BOT_TOKEN?.substring(0, 10) + '...',
            chatId: env.TELEGRAM_CHAT_ID
          });

          // Sanitize content first
          let finalContent = sanitizeForTelegram(content);
          
          // Add footer to manual posts too
          const footer = await getPostFooter(env);
          if (footer.enabled) {
            const footerText = `\n\n━━━━━━━━━━━━━━━━━━━━\n📈 <b>${footer.companyName || 'TradingBot Pro'}</b>\n📱 ${footer.telegramChannel || '@tradingbot'}\n🌐 ${footer.website || 'tradingbot.com'}\n\n#TradingEducation\n\n<i>~ Your Trading Mentor</i> ✍️`;
            finalContent += footerText;
          }

          // Keep content within Telegram message limits (4096 characters for regular messages)
          // Since we're using two-step posting, we can use the full 4096 character limit
          if (finalContent.length > 4000) {
            finalContent = finalContent.slice(0, 3900) + '...\n\n' + (footer.enabled ? `📈 <b>${footer.companyName || 'TradingBot Pro'}</b>\n\n<i>~ Your Trading Mentor</i> ✍️` : '');
          }

          const imgUrl = getUnsplashImageUrl(['trading', 'finance']);
          const result = await postToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, finalContent, imgUrl);
          
          console.warn('Manual post successful');
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
          const body = await request.json();
          
          // Handle bulk add (array of subjects)
          if (body.subjects && Array.isArray(body.subjects)) {
            const { subjects, market, model } = body;
            const results = await bulkAddSubjectsToQueue(env, subjects, market || 'crypto', model || 'deepseek/deepseek-chat-v3.1:free');
            return new Response(JSON.stringify({ 
              success: true, 
              added: results.added,
              failed: results.failed,
              total: subjects.length
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // Handle single subject add
          const { subject, market, model } = body;
          if (!subject) {
            return new Response(JSON.stringify({ error: 'Subject is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          const newItem = await addSubjectToQueue(env, subject, market || 'crypto', model || 'deepseek/deepseek-chat-v3.1:free');
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

      if (path.startsWith('/api/queue/') && request.method === 'PUT') {
        try {
          const subjectId = path.split('/').pop();
          const { subject, market, model } = await request.json();
          
          if (!subject) {
            return new Response(JSON.stringify({ error: 'Subject is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          await updateQueueItem(env, subjectId, subject, market, model);
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
          console.warn('=== TEST POST STARTED ===');
          console.warn('Timestamp:', new Date().toISOString());
          
          // Environment check
          console.warn('Environment check:');
          console.warn('- TELEGRAM_BOT_TOKEN exists:', !!env.TELEGRAM_BOT_TOKEN);
          console.warn('- TELEGRAM_BOT_TOKEN length:', env.TELEGRAM_BOT_TOKEN?.length || 0);
          console.warn('- TELEGRAM_BOT_TOKEN format check:', env.TELEGRAM_BOT_TOKEN?.includes(':') ? 'PASS' : 'FAIL');
          console.warn('- TELEGRAM_CHAT_ID exists:', !!env.TELEGRAM_CHAT_ID);
          console.warn('- TELEGRAM_CHAT_ID value:', env.TELEGRAM_CHAT_ID);
          console.warn('- OPENROUTER_API_KEY exists:', !!env.OPENROUTER_API_KEY);
          
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
          
          console.warn('Environment validation passed, proceeding with test post...');
          const result = await buildAndSend(env);
          console.warn('=== TEST POST COMPLETED SUCCESSFULLY ===');
          
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

      // Schedule management endpoints
      if (path === '/api/schedule' && request.method === 'GET') {
        try {
          // Get current schedule from KV storage or default
          const schedule = await env.SUBJECTS_QUEUE.get('schedule') || '0 * * * *';
          const scheduleStatusRaw = await env.SUBJECTS_QUEUE.get('schedule_status');
          
          let scheduleStatus = null;
          if (scheduleStatusRaw) {
            try {
              scheduleStatus = JSON.parse(scheduleStatusRaw);
            } catch (e) {
              // Ignore parsing errors
            }
          }
          
          // Determine if schedule is applied based on deployment
          const isApplied = !scheduleStatus || scheduleStatus.schedule === schedule;
          
          return new Response(JSON.stringify({ 
            schedule,
            status: isApplied ? 'applied' : 'pending_deployment',
            lastUpdated: scheduleStatus?.updatedAt,
            previousSchedule: scheduleStatus?.previousSchedule,
            deploymentRequired: !isApplied
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ 
            error: 'Failed to get schedule',
            details: error.message 
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      if (path === '/api/schedule' && request.method === 'POST') {
        try {
          const { schedule } = await request.json();
          
          // Validate cron expression format
          if (!schedule || typeof schedule !== 'string') {
            throw new Error('Invalid schedule format');
          }
          
          // Basic cron validation (5 or 6 parts for seconds support)
          const cronParts = schedule.trim().split(/\s+/);
          if (cronParts.length !== 5 && cronParts.length !== 6) {
            throw new Error('Invalid cron expression. Expected 5 or 6 parts (minute hour day month weekday [year])');
          }
          
          // Store the schedule in KV with timestamp
          const scheduleUpdate = {
            schedule,
            updatedAt: new Date().toISOString(),
            applied: false,
            previousSchedule: await env.SUBJECTS_QUEUE.get('schedule') || '0 * * * *'
          };
          
          await env.SUBJECTS_QUEUE.put('schedule', schedule);
          await env.SUBJECTS_QUEUE.put('schedule_status', JSON.stringify(scheduleUpdate));
          
          console.warn('Schedule updated to:', schedule);
          
          return new Response(JSON.stringify({ 
            success: true,
            schedule,
            message: 'Schedule updated in memory. To fully activate, follow these steps:',
            status: 'pending_deployment',
            currentSchedule: scheduleUpdate.previousSchedule,
            newSchedule: schedule,
            warning: '⚠️ IMPORTANT: Worker will continue using old schedule until redeployed',
            instructions: [
              '1. Update wrangler.toml manually OR run the helper script:',
              `   npm run update-schedule "${schedule}"`,
              '2. Deploy the updated worker:',
              '   npm run deploy',
              '3. Verify the new schedule is active in deployment logs',
              '4. Refresh this page to see "Applied" status'
            ],
            quickCommands: [
              `npm run update-schedule "${schedule}"`,
              'npm run deploy'
            ]
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ 
            error: 'Failed to update schedule',
            details: error.message 
          }), {
            status: 400,
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
