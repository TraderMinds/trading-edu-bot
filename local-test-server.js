#!/usr/bin/env node
// local-test-server.js
// Simple test server to demonstrate ngrok connection
const express = require('express');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS headers for Cloudflare Worker access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Test endpoints
app.get('/', (req, res) => {
  res.json({
    message: 'Local server is running!',
    timestamp: new Date().toISOString(),
    endpoint: 'GET /'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    server: 'local-development',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.post('/api/data', (req, res) => {
  console.log('📨 Received data from Worker:', req.body);
  res.json({
    received: req.body,
    processed_at: new Date().toISOString(),
    response: 'Data received successfully!'
  });
});

// List available Ollama models
app.get('/api/models', async (req, res) => {
  console.log('🤖 Models list requested');
  
  try {
    const ollamaResponse = await fetch('http://localhost:11434/api/tags');
    
    if (!ollamaResponse.ok) {
      throw new Error(`Ollama responded with ${ollamaResponse.status}`);
    }
    
    const data = await ollamaResponse.json();
    console.log(`✅ Found ${data.models?.length || 0} local models`);
    
    res.json({
      models: data.models,
      count: data.models?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Models list error:', error.message);
    
    res.json({
      models: [
        { name: 'llama3.2:latest', size: '2.0 GB' },
        { name: 'gemma3:latest', size: '3.3 GB' },
        { name: 'deepseek-r1:latest', size: '5.2 GB' },
        { name: 'gpt-oss:latest', size: '13 GB' }
      ],
      count: 4,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Proxy Ollama endpoint for real AI generation
app.post('/api/generate', async (req, res) => {
  const { model, prompt, stream = false, options = {} } = req.body;
  
  console.log(`🤖 Local AI request - Model: ${model}, Prompt: ${prompt?.substring(0, 50)}...`);
  
  try {
    // Forward to local Ollama instance
    const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'gpt-oss:20b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          ...options
        }
      })
    });
    
    if (!ollamaResponse.ok) {
      throw new Error(`Ollama responded with ${ollamaResponse.status}: ${await ollamaResponse.text()}`);
    }
    
    const data = await ollamaResponse.json();
    console.log(`✅ Ollama generated ${data.response?.length || 0} characters`);
    
    res.json(data);
  } catch (error) {
    console.error('❌ Ollama proxy error:', error.message);
    
    // Fallback to simulated response
    res.json({
      response: `Local AI Response: This is a simulated fallback response for "${prompt?.substring(0, 30)}..." using model ${model}. (Ollama error: ${error.message})`,
      model: model,
      created_at: new Date().toISOString(),
      done: true,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🌟 Local test server running on http://localhost:${PORT}`);
  console.log(`📡 Ready for ngrok tunneling!`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /                - Basic status`);
  console.log(`  GET  /api/status      - Detailed status`);
  console.log(`  GET  /api/models      - List Ollama models`);
  console.log(`  POST /api/data        - Accept data from Worker`);
  console.log(`  POST /api/generate    - Real Ollama AI generation`);
});