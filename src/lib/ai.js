/**
 * ai.js — Gemini AI wrapper, works on ALL deployment targets
 *
 * CORS problem & solution:
 *   Browsers block direct fetch() to generativelanguage.googleapis.com.
 *   We route through a proxy that varies by environment:
 *
 *   ┌─────────────────┬───────────────────────────────────────────────────┐
 *   │ Environment     │ Proxy used                                        │
 *   ├─────────────────┼───────────────────────────────────────────────────┤
 *   │ npm run dev     │ Vite devServer.proxy  →  /api/gemini              │
 *   │ Netlify         │ netlify/functions/gemini.js  →  /api/gemini       │
 *   │ Vercel          │ api/gemini.js  →  /api/gemini                     │
 *   │ GitHub Pages    │ Cloudflare Worker (free)  →  external URL         │
 *   └─────────────────┴───────────────────────────────────────────────────┘
 *
 * For GitHub Pages you need ONE free Cloudflare Worker (5 min setup):
 *   See SETUP.md → "GitHub Pages + Cloudflare Worker"
 *   Then set VITE_GEMINI_PROXY_URL=https://your-worker.workers.dev
 *   in your GitHub repo's Settings → Secrets → Actions → Variables
 *
 * Free Gemini key: https://aistudio.google.com/apikey
 */

const MODEL = 'gemini-2.0-flash';

// Vite replaces import.meta.env.* at build time
// If not set, falls back to the local proxy path (works for dev/Netlify/Vercel)
const PROXY_BASE = import.meta.env.VITE_GEMINI_PROXY_URL
  ? import.meta.env.VITE_GEMINI_PROXY_URL.replace(/\/$/, '') // external CF worker
  : '/api/gemini';                                            // local proxy path

// ─────────────────────────────────────────────────────────────────────────────
// Core call
// ─────────────────────────────────────────────────────────────────────────────

/**
 * callAI — send a conversation to Gemini, return the text reply.
 *
 * @param {string} systemPrompt   Coach persona (can be empty string)
 * @param {Array}  history        [{role:'user'|'model', parts:[{text}]}]
 * @param {string} userMessage    The new user message
 * @param {string} apiKey         Gemini API key  (AIza…)
 * @param {number} maxTokens      Max output tokens (default 512)
 */
export async function callAI(systemPrompt, history = [], userMessage, apiKey, maxTokens = 512) {
  if (!apiKey) throw new Error('NO_KEY');

  const contents = [
    ...history,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const body = {
    ...(systemPrompt ? { system_instruction: { parts: [{ text: systemPrompt }] } } : {}),
    contents,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.75 },
    // Relaxed so chess move names ("attack", "capture", "sacrifice") aren't blocked
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  // Key goes as a query param — the proxy strips it before it reaches Google,
  // so it never appears in outbound browser headers.
  const url = `${PROXY_BASE}/${MODEL}:generateContent?key=${apiKey}`;

  let res;
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error(`Network error — proxy unreachable. (${networkErr.message})`);
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message || msg;
      if (res.status === 400) msg = `Bad request — check your key format (${msg})`;
      if (res.status === 403) msg = `API key invalid or not enabled for Gemini (403)`;
      if (res.status === 429) msg = `Rate limit hit — wait a moment (429)`;
    } catch {}
    throw new Error(msg);
  }

  const data      = await res.json();
  const candidate = data?.candidates?.[0];

  if (!candidate) {
    const reason = data?.promptFeedback?.blockReason;
    throw new Error(reason ? `Blocked: ${reason}` : 'Gemini returned no candidates');
  }
  if (candidate.finishReason === 'SAFETY') {
    throw new Error('Response blocked by Gemini safety filter');
  }

  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty text');
  return text.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convert [{role:'user'|'assistant', content}] → Gemini history format */
export function toGeminiHistory(history) {
  return history.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

/** Single-shot call with no history */
export async function quickComment(prompt, apiKey, maxTokens = 120) {
  return callAI('', [], prompt, apiKey, maxTokens);
}

/**
 * Validate a Gemini key.
 * Returns { ok: true } or { ok: false, error: 'human readable reason' }
 */
export async function validateKey(apiKey) {
  if (!apiKey || !apiKey.startsWith('AIza')) {
    return { ok: false, error: 'Key should start with "AIza"' };
  }
  try {
    const reply = await callAI('', [], 'Reply with exactly one word: ok', apiKey, 5);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** Coach Magnus system prompt */
export function coachSystemPrompt(gameContext = '') {
  return [
    'You are Coach Magnus, a friendly expert chess coach.',
    'Be encouraging, precise, and specific. Use chess notation (e4, Nf3, Qxd5).',
    'Keep answers SHORT — 2-3 sentences unless deep analysis is requested.',
    'No markdown headers or bullet lists unless explicitly asked.',
    'Light chess emoji ♟♔♕ is fine.',
    gameContext ? `\nGame context:\n${gameContext}` : '',
  ].filter(Boolean).join('\n');
}
