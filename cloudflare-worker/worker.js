/**
 * Cloudflare Worker — free Gemini CORS proxy for GitHub Pages
 *
 * Deploy steps (takes ~5 minutes, free forever):
 *   1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. Click "Deploy", then "Edit code"
 *   3. Paste this entire file → Save and Deploy
 *   4. Copy your worker URL (e.g. https://chess-coach-proxy.yourname.workers.dev)
 *   5. In your GitHub repo → Settings → Secrets and variables → Actions
 *      → Variables → New variable:
 *        Name:  VITE_GEMINI_PROXY_URL
 *        Value: https://chess-coach-proxy.yourname.workers.dev
 *   6. Re-run the GitHub Actions workflow — done!
 *
 * Free tier: 100,000 requests/day — more than enough for personal use.
 */

export default {
  async fetch(request, env) {
    // Allow requests from your GitHub Pages domain only
    const origin = request.headers.get('Origin') || '';
    const allowed = [
      'https://officialmikan.github.io',
      'http://localhost:5173',
      'http://localhost:4173',
    ];
    const corsOrigin = allowed.includes(origin) ? origin : allowed[0];

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin':  corsOrigin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age':       '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Parse incoming URL to get model path + key
    const url    = new URL(request.url);
    // Strip leading /  (worker receives full path as-is)
    const path   = url.pathname.replace(/^\//, '');
    const apiKey = url.searchParams.get('key');

    if (!apiKey) {
      return new Response(JSON.stringify({ error: { message: 'Missing key param' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${path}?key=${apiKey}`;

    try {
      const body     = await request.text();
      const upstream = await fetch(googleUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const responseBody = await upstream.text();
      return new Response(responseBody, {
        status:  upstream.status,
        headers: {
          'Content-Type':                 'application/json',
          'Access-Control-Allow-Origin':  corsOrigin,
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: { message: 'Worker proxy error: ' + err.message } }),
        {
          status:  502,
          headers: {
            'Content-Type':                'application/json',
            'Access-Control-Allow-Origin': corsOrigin,
          },
        }
      );
    }
  },
};
