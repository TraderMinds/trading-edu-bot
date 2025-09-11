// Simple test to check if Ollama is working
const express = require('express');
const app = express();
app.use(express.json());

app.get('/test', async (req, res) => {
  try {
    console.log('Testing Ollama connection...');
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    console.log('Ollama models:', data);
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Simple test server on port 3001');
  console.log('Test: http://localhost:3001/test');
});