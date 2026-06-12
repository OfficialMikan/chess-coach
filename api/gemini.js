/**
 * Vercel serverless function — Gemini CORS proxy
 * Deployed path: /api/gemini (Vercel auto-routes api/ folder)
 *
 * Handles:  POST /api/gemini/[model]:generateContent?key=AIza...
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: { message: 'Missing API key' } });

  // req.url is like /api/gemini/gemini-2.0-flash:generateContent
  const modelPath = req.url.replace(/^\/api\/gemini/, '').split('?')[0];
  const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models${modelPath}?key=${key}`;

  try {
    const upstream = await fetch(googleUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(req.body),
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: { message: 'Proxy error: ' + err.message } });
  }
}
