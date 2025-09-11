// Test Ollama through ngrok tunnel
async function testOllamaThroughNgrok() {
  const ngrokUrl = 'https://5a61ec351821.ngrok-free.app';
  
  try {
    console.log('🧪 Testing Ollama generation through ngrok...');
    
    const response = await fetch(`${ngrokUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({
        model: 'gpt-oss:latest',
        prompt: 'Explain risk management in forex trading in 2 sentences.'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log('✅ Ngrok → Ollama Success!');
    console.log('📝 Response:', data.response || data);
    
    return true;
  } catch (error) {
    console.error('❌ Ngrok Test Failed:', error.message);
    return false;
  }
}

testOllamaThroughNgrok();