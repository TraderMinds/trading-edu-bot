// Test Ollama generation
async function testOllama() {
  try {
    console.log('Testing Ollama generation...');
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-oss:latest',
        prompt: 'Hello, how are you today?',
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log('✅ Ollama Response:', data.response);
    console.log('📊 Stats:', {
      model: data.model,
      eval_count: data.eval_count,
      eval_duration: data.eval_duration
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testOllama();