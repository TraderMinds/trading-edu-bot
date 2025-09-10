// Auth middleware for the worker
async function authenticate(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authentication required');
  }

  const token = authHeader.split(' ')[1];
  // Compare with environment variable
  if (token !== process.env.ADMIN_TOKEN) {
    throw new Error('Invalid token');
  }
}

// CORS headers helper
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

module.exports = { authenticate, corsHeaders };
