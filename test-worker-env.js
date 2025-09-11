// Test Worker's Ollama integration through direct API call
async function testWorkerOllama() {
  try {
    console.log('🧪 Testing Worker → Ollama integration...');
    
    // Test the Worker's environment check endpoint
    const response = await fetch('https://trading-edu-bot-worker.tradermindai.workers.dev/api/env-check', {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log('🔧 Worker Environment:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('❌ Worker Test Failed:', error.message);
    return null;
  }
}

testWorkerOllama();