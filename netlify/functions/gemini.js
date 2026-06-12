/**
 * Netlify serverless function — Gemini CORS proxy
 * Deployed path: /.netlify/functions/gemini
 * Mapped to:     /api/gemini  (via netlify.toml redirect below)
 *
 * This relay sits between the browser and Google's API so:
 *  1. No CORS errors (server-to-server call)
 *  2. API key never appears in browser Network tab
 */

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Extract model + key from path + query
  // Incoming: /api/gemini/gemini-2.0-flash:generateContent?key=AIza...
  const path      = event.path.replace(/^\/.netlify\/functions\/gemini/, '');
  const apiKey    = event.queryStringParameters?.key;
  if (!apiKey) return { statusCode: 400, body: JSON.stringify({ error: { message: 'Missing API key' } }) };

  const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models${path}?key=${apiKey}`;

  try {
    const response = await fetch(googleUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    event.body,
    });

    const data = await response.text();
    return {
      statusCode: response.status,
      headers:    { 'Content-Type': 'application/json' },
      body:       data,
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: { message: 'Proxy error: ' + err.message } }),
    };
  }
};
