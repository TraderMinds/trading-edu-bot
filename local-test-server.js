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

// Simulate Ollama endpoint for testing
app.post('/api/generate', (req, res) => {
  const { model, prompt } = req.body;
  
  console.log(`🤖 Local AI request - Model: ${model}, Prompt: ${prompt?.substring(0, 50)}...`);
  
  // Simulate processing time
  setTimeout(() => {
    res.json({
      response: `Local AI Response: This is a simulated response for "${prompt?.substring(0, 30)}..." using model ${model}`,
      model: model,
      created_at: new Date().toISOString(),
      done: true
    });
  }, 1000);
});

app.listen(PORT, () => {
  console.log(`🌟 Local test server running on http://localhost:${PORT}`);
  console.log(`📡 Ready for ngrok tunneling!`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /                - Basic status`);
  console.log(`  GET  /api/status      - Detailed status`);
  console.log(`  POST /api/data        - Accept data from Worker`);
  console.log(`  POST /api/generate    - Simulate Ollama AI`);
});