// Example: Using ngrok URL in your Cloudflare Worker
// Add this to your src/index.js or create a test endpoint

// Worker code to connect to your local server via ngrok
async function testLocalConnection(request, env) {
  try {
    // Replace with your actual ngrok URL
    const NGROK_URL = 'https://your-ngrok-url.ngrok-free.app';
    
    // Test basic connection
    const statusResponse = await fetch(`${NGROK_URL}/api/status`);
    const statusData = await statusResponse.json();
    
    // Send data to local server
    const dataResponse = await fetch(`${NGROK_URL}/api/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello from Cloudflare Worker!',
        timestamp: new Date().toISOString(),
        worker_location: request.cf?.colo || 'unknown'
      })
    });
    const dataResult = await dataResponse.json();
    
    // Test local AI endpoint
    const aiResponse = await fetch(`${NGROK_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local-test-model',
        prompt: 'Generate a test response from local server'
      })
    });
    const aiResult = await aiResponse.json();
    
    return new Response(JSON.stringify({
      success: true,
      local_server_status: statusData,
      data_exchange: dataResult,
      local_ai_response: aiResult,
      connection: 'via ngrok tunnel'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to connect to local server',
      details: error.message,
      tip: 'Make sure ngrok tunnel and local server are running'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Add this to your existing router
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Test local connection endpoint
    if (url.pathname === '/test-local') {
      return testLocalConnection(request, env);
    }
    
    // Your existing routes...
    return new Response('Worker running!');
  }
};