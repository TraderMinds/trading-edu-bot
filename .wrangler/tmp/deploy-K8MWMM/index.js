var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var TELEGRAM_API_BASE = "https://api.telegram.org";
var MAX_RETRIES = 3;
var RETRY_DELAY = 1e3;
var sleep = /* @__PURE__ */ __name((ms) => new Promise((resolve) => setTimeout(resolve, ms)), "sleep");
async function getSubjectsQueue(env) {
  try {
    const queue = await env.SUBJECTS_QUEUE?.get("queue");
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error("Error getting queue:", error);
    return [];
  }
}
__name(getSubjectsQueue, "getSubjectsQueue");
async function getPostFooter(env) {
  try {
    const footer = await env.SUBJECTS_QUEUE?.get("post_footer");
    return footer ? JSON.parse(footer) : {
      companyName: "TradingBot Pro",
      telegramChannel: "@tradingpro",
      website: "tradingbot.com",
      enabled: true
    };
  } catch (error) {
    console.error("Error getting footer:", error);
    return {
      companyName: "TradingBot Pro",
      telegramChannel: "@tradingpro",
      website: "tradingbot.com",
      enabled: true
    };
  }
}
__name(getPostFooter, "getPostFooter");
async function savePostFooter(env, footerData) {
  try {
    if (env.SUBJECTS_QUEUE) {
      await env.SUBJECTS_QUEUE.put("post_footer", JSON.stringify(footerData));
    }
    return true;
  } catch (error) {
    console.error("Error saving footer:", error);
    return false;
  }
}
__name(savePostFooter, "savePostFooter");
async function getPostingStats(env) {
  try {
    const stats = await env.SUBJECTS_QUEUE?.get("posting_stats");
    return stats ? JSON.parse(stats) : {
      totalPosts: 0,
      successfulPosts: 0,
      failedPosts: 0,
      lastPostDate: null,
      postsThisMonth: 0,
      postsThisWeek: 0
    };
  } catch (error) {
    console.error("Error getting stats:", error);
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
__name(getPostingStats, "getPostingStats");
async function updatePostingStats(env, success = true) {
  try {
    const stats = await getPostingStats(env);
    const now = /* @__PURE__ */ new Date();
    stats.totalPosts++;
    if (success) {
      stats.successfulPosts++;
    } else {
      stats.failedPosts++;
    }
    stats.lastPostDate = now.toISOString();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastPostMonth = stats.lastPostDate ? new Date(stats.lastPostDate).getMonth() : -1;
    const lastPostYear = stats.lastPostDate ? new Date(stats.lastPostDate).getFullYear() : -1;
    if (thisMonth !== lastPostMonth || thisYear !== lastPostYear) {
      stats.postsThisMonth = 1;
    } else {
      stats.postsThisMonth++;
    }
    const daysDiff = Math.floor((now - new Date(stats.lastPostDate || 0)) / (1e3 * 60 * 60 * 24));
    if (daysDiff > 7) {
      stats.postsThisWeek = 1;
    } else {
      stats.postsThisWeek++;
    }
    if (env.SUBJECTS_QUEUE) {
      await env.SUBJECTS_QUEUE.put("posting_stats", JSON.stringify(stats));
    }
    return stats;
  } catch (error) {
    console.error("Error updating stats:", error);
    return null;
  }
}
__name(updatePostingStats, "updatePostingStats");
async function saveSubjectsQueue(env, queue) {
  try {
    if (env.SUBJECTS_QUEUE) {
      await env.SUBJECTS_QUEUE.put("queue", JSON.stringify(queue));
    }
    return true;
  } catch (error) {
    console.error("Error saving queue:", error);
    return false;
  }
}
__name(saveSubjectsQueue, "saveSubjectsQueue");
async function addSubjectToQueue(env, subject, market = "crypto") {
  const queue = await getSubjectsQueue(env);
  const newItem = {
    id: Date.now().toString(),
    subject: subject.trim(),
    market,
    addedAt: (/* @__PURE__ */ new Date()).toISOString(),
    processed: false
  };
  queue.push(newItem);
  await saveSubjectsQueue(env, queue);
  return newItem;
}
__name(addSubjectToQueue, "addSubjectToQueue");
async function getNextSubject(env) {
  const queue = await getSubjectsQueue(env);
  return queue.find((item) => !item.processed) || null;
}
__name(getNextSubject, "getNextSubject");
async function removeSubjectFromQueue(env, subjectId) {
  const queue = await getSubjectsQueue(env);
  const filteredQueue = queue.filter((item) => item.id !== subjectId);
  await saveSubjectsQueue(env, filteredQueue);
}
__name(removeSubjectFromQueue, "removeSubjectFromQueue");
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After") || RETRY_DELAY;
        await sleep(parseInt(retryAfter) * 1e3);
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(RETRY_DELAY * Math.pow(2, i));
    }
  }
}
__name(fetchWithRetry, "fetchWithRetry");
async function generateTextWithOpenRouter(prompt, apiKey, model = "openai/gpt-oss-20b:free") {
  if (!apiKey) {
    throw new Error("OpenRouter API key is required");
  }
  const url = "https://openrouter.ai/api/v1/chat/completions";
  console.log("Generating content with OpenRouter:", {
    hasApiKey: !!apiKey,
    model,
    promptLength: prompt.length
  });
  const body = {
    model,
    messages: [
      {
        role: "system",
        content: `You are an elite trading educator and financial analyst with 20+ years of experience across forex, cryptocurrency, and stock markets. Your mission is to create world-class educational content that transforms beginners into profitable, disciplined traders.

        \u{1F3AF} TELEGRAM POST STRUCTURE (Follow this EXACT format):

        \u{1F4F1} HEADER SECTION:
        \u2022 Eye-catching title with relevant emojis (max 60 characters)
        \u2022 Quick stats or hook (1-2 lines)
        \u2022 Reading time estimate: \u23F1\uFE0F 3-4 minutes

        \u{1F525} HOOK SECTION:
        \u2022 Start with a compelling problem or surprising fact
        \u2022 Use statistics or real market examples
        \u2022 Create urgency or curiosity in 2-3 lines

        \u{1F4DA} MAIN CONTENT (3-4 focused sections):
        
        SECTION 1: Core Concept
        \u2022 Define the main topic clearly
        \u2022 Explain why it matters (2-3 bullet points)
        \u2022 Include 1 specific example with numbers
        
        SECTION 2: Practical Application 
        \u2022 Step-by-step implementation guide
        \u2022 Real trading scenarios with specific setups
        \u2022 Common mistakes to avoid
        
        SECTION 3: Advanced Tips
        \u2022 Pro-level insights and techniques  
        \u2022 Market psychology elements
        \u2022 Risk management integration
        
        [OPTIONAL] SECTION 4: Market Context
        \u2022 Current market conditions relevance
        \u2022 Upcoming events or catalysts
        \u2022 Adaptation strategies

        \u{1F3AF} ACTION SECTION:
        \u2022 3-5 immediately actionable steps
        \u2022 Specific tools or resources mentioned
        \u2022 Practice exercises or homework

        \u{1F4C8} CONCLUSION:
        \u2022 Key takeaway in one powerful sentence
        \u2022 Motivation or mindset advice
        \u2022 Call to action or next learning step

        \uFFFD TELEGRAM OPTIMIZATION REQUIREMENTS:

        LENGTH & STRUCTURE:
        \u2022 Total length: 1800-2800 characters (Telegram caption limit)
        \u2022 Use short, punchy sentences (10-15 words max)
        \u2022 Break long concepts into digestible chunks
        \u2022 Each paragraph max 2-3 lines on mobile

        FORMATTING RULES:
        \u2022 ONLY use: <b>bold</b>, <i>italic</i>, <u>underline</u>, <code>code</code>
        \u2022 NEVER use: <ul>, <ol>, <li>, <p>, <h1-h6>, <br>, <div>, <span>
        \u2022 Use \u2022 for bullet points (never HTML lists)
        \u2022 Use 1., 2., 3. for numbered lists (never HTML)
        \u2022 Section dividers: \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

        VISUAL HIERARCHY:
        \u2022 Main sections: \u{1F4CA} <b>SECTION NAME</b>
        \u2022 Key concepts: <b>Bold for emphasis</b>
        \u2022 Tips: \u{1F4A1} <i>Italicized insights</i>
        \u2022 Warnings: \u26A0\uFE0F <u>Underlined critical points</u>
        \u2022 Code/formulas: <code>Technical terms</code>

        ENGAGEMENT ELEMENTS:
        \u2022 Strategic emoji usage (enhance, don't overwhelm)
        \u2022 Questions to reader: "Have you experienced this?"
        \u2022 Direct address: "Your next step is..."
        \u2022 Urgency: "Start this today" / "Don't wait until..."

        CONTENT QUALITY STANDARDS:

        SPECIFICITY:
        \u2022 Include exact numbers: "Risk 1-2% per trade" not "risk a small amount"
        \u2022 Name specific indicators: "RSI below 30" not "oversold conditions"  
        \u2022 Give precise timeframes: "15-minute chart" not "short timeframe"
        \u2022 Reference actual price levels when relevant

        ACTIONABILITY:
        \u2022 Every tip must be immediately implementable
        \u2022 Provide exact steps, not vague advice
        \u2022 Include tool recommendations when helpful
        \u2022 Give homework or practice exercises

        EDUCATIONAL DEPTH:
        \u2022 Explain the "why" behind each strategy
        \u2022 Connect concepts to market psychology
        \u2022 Show both theory and real-world application
        \u2022 Address different skill levels appropriately

        MARKET RELEVANCE:
        \u2022 Reference current market conditions when possible
        \u2022 Mention recent examples or case studies
        \u2022 Connect to trending topics or events
        \u2022 Show adaptability across market cycles

        \u{1F9E0} EXPERT KNOWLEDGE AREAS:

        TECHNICAL ANALYSIS:
        \u2022 Chart patterns, candlestick analysis, indicator strategies
        \u2022 Multi-timeframe analysis, support/resistance dynamics
        \u2022 Volume analysis, market structure, trend identification

        RISK MANAGEMENT:
        \u2022 Position sizing formulas, stop-loss strategies
        \u2022 Portfolio theory, correlation analysis, drawdown management
        \u2022 Kelly criterion, risk-reward optimization

        TRADING PSYCHOLOGY:
        \u2022 Emotional control, discipline building, bias recognition
        \u2022 Performance psychology, stress management
        \u2022 Habit formation, mindset development

        MARKET DYNAMICS:
        \u2022 Order flow, institutional behavior, market microstructure
        \u2022 Economic indicators, central bank policy, global correlations
        \u2022 Volatility patterns, seasonal effects, market cycles

        \u{1F3AF} SUCCESS METRICS:
        Your content should make readers think: "This is exactly what I needed to know" and "I can implement this right away."

        Focus on transformation, not just information. Build traders who think and act like professionals.`
      },
      { role: "user", content: prompt }
    ],
    max_tokens: 3500,
    // Optimized for Telegram post length (was too high at 12000)
    temperature: 0.75,
    // Balanced creativity and consistency
    top_p: 0.85,
    // Focused coherence for educational content
    frequency_penalty: 0.3,
    // Reduce repetition significantly
    presence_penalty: 0.2
    // Encourage topic diversity
  };
  console.log("Making OpenRouter API request with body:", JSON.stringify(body));
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3e4);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://trading-edu-bot-worker.tradermindai.workers.dev",
        "X-Title": "Trading Education Bot",
        "X-Model": body.model
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    console.log("OpenRouter API response status:", res.status);
    if (!res.ok) {
      const txt = await res.text();
      console.error("OpenRouter API error response:", txt);
      throw new Error(`API error (${res.status}): ${txt}`);
    }
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
  } catch (error) {
    console.error("OpenRouter API error:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    if (error.name === "AbortError") {
      throw new Error("Request timeout: AI generation took too long (>30s)");
    } else if (error.message.includes("fetch")) {
      throw new Error("Network error: Unable to connect to AI service");
    } else {
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }
}
__name(generateTextWithOpenRouter, "generateTextWithOpenRouter");
function sanitizeForTelegram(content) {
  if (!content) return "";
  console.log("Sanitizing content for Telegram, original length:", content.length);
  let sanitized = content.replace(/<ul[^>]*>/gi, "").replace(/<\/ul>/gi, "").replace(/<ol[^>]*>/gi, "").replace(/<\/ol>/gi, "").replace(/<li[^>]*>/gi, "\u2022 ").replace(/<\/li>/gi, "\n").replace(/<h[1-6][^>]*>/gi, "\n<b>").replace(/<\/h[1-6]>/gi, "</b>\n").replace(/<p[^>]*>/gi, "").replace(/<\/p>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n").replace(/<strong[^>]*>/gi, "<b>").replace(/<\/strong>/gi, "</b>").replace(/<em[^>]*>/gi, "<i>").replace(/<\/em>/gi, "</i>").replace(/<(?!\/?(b|i|u|s|code|pre|a\s)[^>]*>)[^>]+>/gi, "");
  sanitized = fixUnmatchedTags(sanitized);
  sanitized = sanitized.replace(/\n{3,}/g, "\n\n").replace(/\s*\n\s*/g, "\n").trim();
  console.log("Content sanitized for Telegram, new length:", sanitized.length);
  const remainingTags = sanitized.match(/<[^>]+>/g);
  if (remainingTags) {
    console.log("Remaining HTML tags after sanitization:", remainingTags);
  }
  return sanitized;
}
__name(sanitizeForTelegram, "sanitizeForTelegram");
function fixUnmatchedTags(content) {
  const supportedTags = ["b", "i", "u", "code", "s"];
  let fixed = content;
  supportedTags.forEach((tag) => {
    const openingMatches = fixed.match(new RegExp(`<${tag}\\b[^>]*>`, "gi")) || [];
    const closingMatches = fixed.match(new RegExp(`</${tag}>`, "gi")) || [];
    console.log(`Tag ${tag}: ${openingMatches.length} opening, ${closingMatches.length} closing`);
    if (openingMatches.length !== closingMatches.length) {
      console.warn(`Unmatched ${tag} tags detected, removing all ${tag} tags`);
      fixed = fixed.replace(new RegExp(`<${tag}\\b[^>]*>`, "gi"), "").replace(new RegExp(`</${tag}>`, "gi"), "");
    }
  });
  return fixed;
}
__name(fixUnmatchedTags, "fixUnmatchedTags");
function getUnsplashImageUrl(keywords) {
  const q = encodeURIComponent(keywords.join(","));
  return `https://source.unsplash.com/1600x900/?${q}`;
}
__name(getUnsplashImageUrl, "getUnsplashImageUrl");
async function validateImageUrl(imageUrl) {
  console.log("Validating image URL:", imageUrl);
  try {
    const response = await fetch(imageUrl, { method: "HEAD" });
    const contentType = response.headers.get("content-type");
    const contentLength = response.headers.get("content-length");
    console.log("Image validation result:", {
      status: response.status,
      contentType,
      contentLength,
      url: imageUrl
    });
    if (!contentType || !contentType.startsWith("image/")) {
      console.error("URL does not return an image. Content-Type:", contentType);
      return false;
    }
    if (contentLength && parseInt(contentLength) > 20 * 1024 * 1024) {
      console.error("Image too large:", contentLength);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error validating image URL:", error);
    return false;
  }
}
__name(validateImageUrl, "validateImageUrl");
function getBackupImageUrl() {
  const backupImages = [
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&h=900&fit=crop&crop=center",
    // Trading chart
    "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1600&h=900&fit=crop&crop=center",
    // Financial data
    "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1600&h=900&fit=crop&crop=center",
    // Stock market
    "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=1600&h=900&fit=crop&crop=center",
    // Charts
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1600&h=900&fit=crop&crop=center"
    // Finance
  ];
  return backupImages[Math.floor(Math.random() * backupImages.length)];
}
__name(getBackupImageUrl, "getBackupImageUrl");
async function postToTelegram(botToken, chatId, caption, imageUrl) {
  if (!botToken || !chatId) {
    throw new Error(`Missing required Telegram parameters: botToken=${!!botToken}, chatId=${!!chatId}`);
  }
  if (!botToken.includes(":") || botToken.length < 40) {
    throw new Error("Invalid Telegram bot token format");
  }
  if (!chatId.toString().match(/^(-?\d+|@\w+)$/)) {
    console.warn("Unusual chat ID format:", chatId);
  }
  console.log("Starting two-step posting process: image first, then full content as reply");
  let imageMessageId;
  try {
    let finalImageUrl = imageUrl;
    const isValidImage = await validateImageUrl(imageUrl);
    if (!isValidImage) {
      console.warn("Original image URL failed validation, using backup");
      finalImageUrl = getBackupImageUrl();
      const isBackupValid = await validateImageUrl(finalImageUrl);
      if (!isBackupValid) {
        console.warn("Backup image also failed, trying another backup");
        finalImageUrl = getBackupImageUrl();
      }
    }
    const photoEndpoint = `${TELEGRAM_API_BASE}/bot${botToken}/sendPhoto`;
    const imageBody = {
      chat_id: chatId,
      photo: finalImageUrl,
      caption: "\u{1F4CA} Trading Education",
      // Minimal caption
      parse_mode: "HTML"
    };
    console.log("Sending image:", {
      endpoint: photoEndpoint.replace(botToken, "[REDACTED]"),
      finalImageUrl: finalImageUrl?.substring(0, 50) + "...",
      chatId
    });
    const imageRes = await fetchWithRetry(photoEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TradingBot/1.0"
      },
      body: JSON.stringify(imageBody)
    });
    const imageResText = await imageRes.text();
    if (!imageRes.ok) {
      console.error("Image posting failed:", imageResText);
      throw new Error(`Image posting failed: ${imageRes.status} - ${imageResText}`);
    }
    const imageResponseData = JSON.parse(imageResText);
    imageMessageId = imageResponseData.result.message_id;
    console.log("Image posted successfully, message ID:", imageMessageId);
  } catch (imageError) {
    console.error("Image posting failed, falling back to text-only:", imageError.message);
    try {
      const textEndpoint = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;
      const textOnlyBody = {
        chat_id: chatId,
        text: caption || "Trading Education Content",
        parse_mode: "HTML"
      };
      const textRes = await fetchWithRetry(textEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "TradingBot/1.0"
        },
        body: JSON.stringify(textOnlyBody)
      });
      const textResText = await textRes.text();
      if (textRes.ok) {
        console.log("Text-only fallback successful");
        return textResText;
      } else {
        throw new Error(`Text fallback also failed: ${textRes.status} - ${textResText}`);
      }
    } catch (textError) {
      console.error("All posting methods failed:", textError.message);
      throw new Error(`Complete posting failure: ${imageError.message}, ${textError.message}`);
    }
  }
  try {
    const messageEndpoint = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;
    const replyBody = {
      chat_id: chatId,
      text: caption || "Trading Education Content",
      parse_mode: "HTML",
      reply_to_message_id: imageMessageId
    };
    console.log("Sending full content as reply:", {
      endpoint: messageEndpoint.replace(botToken, "[REDACTED]"),
      contentLength: caption?.length,
      replyToMessageId: imageMessageId
    });
    const replyRes = await fetchWithRetry(messageEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TradingBot/1.0"
      },
      body: JSON.stringify(replyBody)
    });
    const replyResText = await replyRes.text();
    if (!replyRes.ok) {
      console.error("Reply message failed:", replyResText);
      console.log("Attempting reply without HTML formatting");
      const plainTextBody = {
        chat_id: chatId,
        text: caption.replace(/<[^>]*>/g, "") || "Trading Education Content",
        reply_to_message_id: imageMessageId
      };
      const plainRes = await fetchWithRetry(messageEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "TradingBot/1.0"
        },
        body: JSON.stringify(plainTextBody)
      });
      const plainResText = await plainRes.text();
      if (plainRes.ok) {
        console.log("Plain text reply successful");
        return plainResText;
      } else {
        throw new Error(`Reply failed with HTML and plain text: ${replyResText}, ${plainResText}`);
      }
    }
    console.log("Two-step posting completed successfully");
    return replyResText;
  } catch (replyError) {
    console.error("Reply message failed:", replyError.message);
    console.log("Image was posted successfully, but reply failed");
    return `Image posted successfully (ID: ${imageMessageId}), but reply failed: ${replyError.message}`;
  }
}
__name(postToTelegram, "postToTelegram");
async function buildAndSend(env) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
  const nextSubject = await getNextSubject(env);
  let topic, prompt;
  if (nextSubject) {
    console.log("Processing queued subject:", nextSubject);
    topic = nextSubject.market;
    prompt = `Create an extensive, comprehensive educational guide about "${nextSubject.subject}" for ${nextSubject.market} traders. 

Include the following in your response:
\u{1F4DA} **Introduction & Definition**: Clear explanation of the concept
\u{1F4D6} **How it Works**: Step-by-step breakdown of the process
\u{1F4A1} **Key Strategies**: 3-4 practical strategies traders can use
\u26A0\uFE0F **Risk Management**: Important risks and how to mitigate them
\u{1F4C8} **Real-World Examples**: Concrete examples of application
\u{1F3AF} **Action Steps**: What traders should do next
\u{1F4AA} **Pro Tips**: Advanced insights for better results

Format with HTML tags for Telegram (use <b></b> for bold, <i></i> for italics).
Aim for 2000-3000 characters to provide comprehensive educational value.
Make it detailed, informative, and highly actionable for serious traders.`;
  } else {
    topic = ["crypto", "forex"][Math.floor(Math.random() * 2)];
    prompt = `Write an extensive educational trading guide for ${topic} traders. 

Include the following sections:
\u{1F4DA} **Topic Overview**: Pick an important trading concept and explain it clearly
\u{1F4D6} **Core Principles**: How the concept works in practice
\u{1F4A1} **Trading Strategies**: 3-4 actionable strategies
\u26A0\uFE0F **Risk Management**: Key risks and mitigation techniques
\u{1F4C8} **Market Examples**: Real scenarios where this applies
\u{1F3AF} **Implementation**: Step-by-step action plan
\u{1F4AA} **Advanced Tips**: Pro-level insights

Format with HTML tags for Telegram (use <b></b> for bold, <i></i> for italics).
Aim for 2000-3000 characters to provide comprehensive educational value.
Keep it highly actionable and professional for serious traders.`;
  }
  let caption = "";
  if (env.OPENROUTER_API_KEY) {
    try {
      const scheduledModel = "deepseek/deepseek-chat-v3.1:free";
      caption = await generateTextWithOpenRouter(prompt, env.OPENROUTER_API_KEY, scheduledModel);
    } catch (err) {
      console.error("OpenRouter call failed:", err.message);
      console.log("No fallback content available - skipping post");
      throw new Error(`AI API not working: ${err.message}`);
    }
  } else {
    console.error("No OpenRouter API key configured");
    console.log("No API key available - skipping post");
    throw new Error("OpenRouter API key not configured");
  }
  caption = sanitizeForTelegram(caption);
  const footer = await getPostFooter(env);
  if (footer.enabled) {
    const footerText = `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F4C8} <b>${footer.companyName || "TradingBot Pro"}</b>
\u{1F4F1} ${footer.telegramChannel || "@tradingbot"}
\u{1F310} ${footer.website || "tradingbot.com"}

#TradingEducation #${topic.charAt(0).toUpperCase() + topic.slice(1)}Trading

<i>~ Your Trading Mentor</i> \u270D\uFE0F`;
    caption += footerText;
  }
  if (caption.length > 4e3) {
    caption = caption.slice(0, 3900) + "...\n\n" + (footer.enabled ? `\u{1F4C8} <b>${footer.companyName || "TradingBot Pro"}</b>

<i>~ Your Trading Mentor</i> \u270D\uFE0F` : "");
  }
  const imgUrl = getUnsplashImageUrl([topic, "trading", "finance"]);
  console.log("Final caption length:", caption.length);
  console.log("Image URL:", imgUrl);
  const sendResult = await postToTelegram(botToken, chatId, caption, imgUrl);
  await updatePostingStats(env, true);
  if (nextSubject) {
    await removeSubjectFromQueue(env, nextSubject.id);
    console.log("Subject processed and removed from queue:", nextSubject.subject);
  }
  return sendResult;
}
__name(buildAndSend, "buildAndSend");
var index_default = {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const res = await buildAndSend(env);
        console.log("Posted to Telegram:", res);
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
                                        <option value="crypto">\u{1F4C8} Crypto</option>
                                        <option value="forex">\u{1F4B1} Forex</option>
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
                                        <option value="crypto">\u{1F4C8} Cryptocurrency</option>
                                        <option value="forex">\u{1F4B1} Forex</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-medium mb-2 text-gray-700">
                                    <i class="fas fa-brain mr-1"></i>AI Model
                                </label>
                                <select id="model" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500">
                                    <optgroup label="\u{1F193} Free Models">
                                        <option value="openai/gpt-oss-120b:free">\u26A1 GPT OSS 120B - Most Powerful</option>
                                        <option value="deepseek/deepseek-chat-v3.1:free">\u{1F9E0} DeepSeek V3.1 - Advanced Reasoning</option>
                                        <option value="nvidia/nemotron-nano-9b-v2:free">\u{1F525} NVIDIA Nemotron Nano 9B V2 - Latest</option>
                                        <option value="openai/gpt-oss-20b:free" selected>\u{1F680} GPT OSS 20B - Fast & Reliable</option>
                                        <option value="z-ai/glm-4.5-air:free">\u{1F4A8} GLM 4.5 Air - Efficient</option>
                                        <option value="qwen/qwen3-coder:free">\u{1F4BB} Qwen3 Coder - Code-Optimized</option>
                                    </optgroup>
                                    <optgroup label="\u{1F31F} Premium Models">
                                        <option value="openrouter/sonoma-sky-alpha">\u2601\uFE0F Sonoma Sky Alpha - Creative</option>
                                        <option value="openrouter/sonoma-dusk-alpha">\u{1F305} Sonoma Dusk Alpha - Balanced</option>
                                    </optgroup>
                                </select>
                                <p class="text-xs text-gray-500 mt-1">\u{1F4A1} Free models have usage limits. Premium models require credits.</p>
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
                                    <option value="0 * * * *">\u26A1 Every hour</option>
                                    <option value="0 */2 * * *">\u{1F550} Every 2 hours</option>
                                    <option value="0 */4 * * *">\u{1F553} Every 4 hours</option>
                                    <option value="0 */6 * * *">\u{1F555} Every 6 hours</option>
                                    <option value="0 */12 * * *">\u{1F313} Every 12 hours</option>
                                    <option value="0 0 * * *">\u{1F305} Once per day</option>
                                    <option value="0 0 * * 1">\u{1F4C5} Weekly (Monday)</option>
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

                showNotification('Posted successfully to Telegram! \u{1F389}', 'success');
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

            const footerText = \`\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F4C8} \${companyName || 'Company Name'}
\u{1F4F1} \${telegramChannel || '@channel'}
\u{1F310} \${website || 'website.com'}

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
                        \`Status: \${response.status}
Error: \${data.error}
Details: \${data.details || 'No additional details'}
Timestamp: \${data.timestamp || new Date().toISOString()}\`;
                    throw new Error(data.error || 'Test post failed');
                }
                
                showNotification('Test post sent successfully! \u{1F680}', 'success');
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
                            \${data.environment.hasBotToken ? '\u2713 Set' : '\u2717 Missing'}
                            \${data.environment.hasBotToken ? \` (\${data.environment.botTokenLength} chars, \${data.environment.botTokenFormat})\` : ''}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span>TELEGRAM_CHAT_ID:</span> 
                        <span class="\${data.environment.hasChatId ? 'text-green-600' : 'text-red-600'}">
                            \${data.environment.hasChatId ? '\u2713 Set' : '\u2717 Missing'}
                            \${data.environment.hasChatId ? \` (\${data.environment.chatId}, \${data.environment.chatIdType})\` : ''}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span>OPENROUTER_API_KEY:</span> 
                        <span class="\${data.environment.hasOpenRouterKey ? 'text-green-600' : 'text-yellow-600'}">
                            \${data.environment.hasOpenRouterKey ? '\u2713 Set' : '\u26A0 Missing (Optional)'}
                            \${data.environment.hasOpenRouterKey ? \` (\${data.environment.openRouterKeyLength} chars)\` : ''}
                        </span>
                    </div>
                    <div class="mt-3 pt-3 border-t">
                        <div class="flex justify-between">
                            <span>Configuration Status:</span> 
                            <span class="\${data.validation.configurationComplete ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}">
                                \${data.validation.configurationComplete ? '\u2713 READY' : '\u2717 INCOMPLETE'}
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
          const prompt = `Create an expert-level educational guide about "${subject}" specifically for ${market} trading.

\u{1F3AF} TOPIC FOCUS: ${subject}
\u{1F4B9} MARKET: ${market.charAt(0).toUpperCase() + market.slice(1)}
\u{1F4CA} TARGET AUDIENCE: Intermediate to advanced traders seeking actionable insights

\u{1F4DD} CONTENT REQUIREMENTS:
\u2022 Provide deep, actionable insights about ${subject}
\u2022 Include ${market}-specific examples and scenarios
\u2022 Cover both theoretical concepts and practical implementation
\u2022 Address common pitfalls and how to avoid them
\u2022 Include specific metrics, timeframes, and risk parameters
\u2022 Reference current market dynamics where relevant

\u{1F3A8} STRUCTURE GUIDELINES:
1. Compelling title with problem/solution angle
2. Quick value proposition (why this matters now)
3. Core concept breakdown with examples
4. ${market.charAt(0).toUpperCase() + market.slice(1)}-specific applications
5. Implementation roadmap with specific steps
6. Risk management considerations
7. Advanced tips from professional perspective
8. Actionable next steps

\u{1F4A1} MAKE IT PRACTICAL:
- Include specific numbers and percentages
- Provide exact timeframes and conditions
- Give real trading scenarios
- Mention specific tools and indicators relevant to ${market}
- Address psychological aspects of implementing ${subject}

Remember: This should be professional-grade content that traders can immediately apply to improve their ${market} trading results.`;
          let content = "";
          if (env.OPENROUTER_API_KEY) {
            try {
              content = await generateTextWithOpenRouter(prompt, env.OPENROUTER_API_KEY, model);
              if (!content) {
                throw new Error("No content generated");
              }
              content = content.replace(/\n\s*\n/g, "\n\n").replace(/•/g, "\u2022").replace(/---/g, "\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n").replace(/\*(.*?)\*/g, "<b>$1</b>").replace(/_(.*?)_/g, "<i>$1</i>").replace(/~(.*?)~/g, "<u>$1</u>");
              content = sanitizeForTelegram(content);
            } catch (aiError) {
              console.error("AI generation error:", aiError);
              return new Response(JSON.stringify({
                error: "AI API not working: " + (aiError.message || "Unknown error")
              }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
              });
            }
          } else {
            return new Response(JSON.stringify({
              error: "OpenRouter API key not configured"
            }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
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
          if (!content) {
            console.error("No content provided in request body");
            return new Response(JSON.stringify({ error: "No content provided" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
          }
          if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
            console.error("Missing Telegram configuration:", {
              hasToken: !!env.TELEGRAM_BOT_TOKEN,
              hasChatId: !!env.TELEGRAM_CHAT_ID,
              tokenLength: env.TELEGRAM_BOT_TOKEN?.length || 0,
              chatId: env.TELEGRAM_CHAT_ID
            });
            return new Response(JSON.stringify({
              error: "Telegram configuration missing. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables."
            }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
          }
          console.log("Manual post attempt...", {
            contentLength: content.length,
            hasToken: !!env.TELEGRAM_BOT_TOKEN,
            hasChatId: !!env.TELEGRAM_CHAT_ID,
            tokenPrefix: env.TELEGRAM_BOT_TOKEN?.substring(0, 10) + "...",
            chatId: env.TELEGRAM_CHAT_ID
          });
          let finalContent = sanitizeForTelegram(content);
          const footer = await getPostFooter(env);
          if (footer.enabled) {
            const footerText = `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F4C8} <b>${footer.companyName || "TradingBot Pro"}</b>
\u{1F4F1} ${footer.telegramChannel || "@tradingbot"}
\u{1F310} ${footer.website || "tradingbot.com"}

#TradingEducation

<i>~ Your Trading Mentor</i> \u270D\uFE0F`;
            finalContent += footerText;
          }
          if (finalContent.length > 1020) {
            finalContent = finalContent.slice(0, 1e3) + "...\n\n" + (footer.enabled ? `\u{1F4C8} <b>${footer.companyName || "TradingBot Pro"}</b>

<i>~ Your Trading Mentor</i> \u270D\uFE0F` : "");
          }
          const imgUrl = getUnsplashImageUrl(["trading", "finance"]);
          const result = await postToTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, finalContent, imgUrl);
          console.log("Manual post successful");
          await updatePostingStats(env, true);
          return new Response(JSON.stringify({ success: true, result }), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (error) {
          console.error("Manual post error:", {
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
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      if (path === "/api/queue" && request.method === "GET") {
        try {
          const queue = await getSubjectsQueue(env);
          return new Response(JSON.stringify({ queue }), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      if (path === "/api/queue" && request.method === "POST") {
        try {
          const { subject, market } = await request.json();
          if (!subject) {
            return new Response(JSON.stringify({ error: "Subject is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
          }
          const newItem = await addSubjectToQueue(env, subject, market || "crypto");
          return new Response(JSON.stringify({ success: true, item: newItem }), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      if (path.startsWith("/api/queue/") && request.method === "DELETE") {
        try {
          const subjectId = path.split("/").pop();
          if (subjectId === "clear") {
            await saveSubjectsQueue(env, []);
          } else {
            await removeSubjectFromQueue(env, subjectId);
          }
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
      if (path === "/api/stats" && request.method === "GET") {
        try {
          const stats = await getPostingStats(env);
          return new Response(JSON.stringify({ stats }), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      if (path === "/api/footer" && request.method === "GET") {
        try {
          const footer = await getPostFooter(env);
          return new Response(JSON.stringify({ footer }), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      if (path === "/api/footer" && request.method === "POST") {
        try {
          const { footer } = await request.json();
          await savePostFooter(env, footer);
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
      if (path === "/api/debug" && request.method === "GET") {
        try {
          const debugInfo = {
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            environment: {
              hasBotToken: !!env.TELEGRAM_BOT_TOKEN,
              botTokenLength: env.TELEGRAM_BOT_TOKEN?.length || 0,
              botTokenFormat: env.TELEGRAM_BOT_TOKEN ? env.TELEGRAM_BOT_TOKEN.includes(":") ? "Valid format" : "Invalid format (missing colon)" : "Not set",
              hasChatId: !!env.TELEGRAM_CHAT_ID,
              chatId: env.TELEGRAM_CHAT_ID || "Not set",
              chatIdType: env.TELEGRAM_CHAT_ID ? env.TELEGRAM_CHAT_ID.toString().startsWith("-") ? "Group/Channel" : env.TELEGRAM_CHAT_ID.toString().startsWith("@") ? "Username" : "Private chat" : "Not set",
              hasOpenRouterKey: !!env.OPENROUTER_API_KEY,
              openRouterKeyLength: env.OPENROUTER_API_KEY?.length || 0
            },
            validation: {
              botTokenValid: env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TOKEN.includes(":") && env.TELEGRAM_BOT_TOKEN.length > 40,
              chatIdValid: env.TELEGRAM_CHAT_ID && env.TELEGRAM_CHAT_ID.toString().match(/^(-?\d+|@\w+)$/),
              configurationComplete: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID)
            }
          };
          return new Response(JSON.stringify(debugInfo), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: "Debug check failed",
            details: error.message
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      if (path === "/api/test-post" && request.method === "POST") {
        try {
          console.log("=== TEST POST STARTED ===");
          console.log("Timestamp:", (/* @__PURE__ */ new Date()).toISOString());
          console.log("Environment check:");
          console.log("- TELEGRAM_BOT_TOKEN exists:", !!env.TELEGRAM_BOT_TOKEN);
          console.log("- TELEGRAM_BOT_TOKEN length:", env.TELEGRAM_BOT_TOKEN?.length || 0);
          console.log("- TELEGRAM_BOT_TOKEN format check:", env.TELEGRAM_BOT_TOKEN?.includes(":") ? "PASS" : "FAIL");
          console.log("- TELEGRAM_CHAT_ID exists:", !!env.TELEGRAM_CHAT_ID);
          console.log("- TELEGRAM_CHAT_ID value:", env.TELEGRAM_CHAT_ID);
          console.log("- OPENROUTER_API_KEY exists:", !!env.OPENROUTER_API_KEY);
          if (!env.TELEGRAM_BOT_TOKEN) {
            const error = "TELEGRAM_BOT_TOKEN environment variable is not set. Please configure it using: wrangler secret put TELEGRAM_BOT_TOKEN";
            console.error("CRITICAL ERROR:", error);
            throw new Error(error);
          }
          if (!env.TELEGRAM_BOT_TOKEN.includes(":")) {
            const error = "TELEGRAM_BOT_TOKEN format is invalid. It should look like: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
            console.error("CRITICAL ERROR:", error);
            throw new Error(error);
          }
          if (!env.TELEGRAM_CHAT_ID) {
            const error = "TELEGRAM_CHAT_ID environment variable is not set. Please configure it using: wrangler secret put TELEGRAM_CHAT_ID";
            console.error("CRITICAL ERROR:", error);
            throw new Error(error);
          }
          console.log("Environment validation passed, proceeding with test post...");
          const result = await buildAndSend(env);
          console.log("=== TEST POST COMPLETED SUCCESSFULLY ===");
          return new Response(JSON.stringify({
            success: true,
            result,
            message: "Test post sent successfully!"
          }), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (error) {
          console.error("=== TEST POST FAILED ===");
          console.error("Error name:", error.name);
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);
          await updatePostingStats(env, false);
          return new Response(JSON.stringify({
            error: error.message,
            details: error.stack,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          }), {
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
