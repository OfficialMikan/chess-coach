/**
 * ai.js — Gemini AI wrapper with CORS-safe proxy routing
 *
 * CORS fix explanation:
 *   Browsers block direct fetch() to generativelanguage.googleapis.com from
 *   localhost (and most deployed origins) because Google doesn't send the
 *   Access-Control-Allow-Origin header for API key requests.
 *
 *   Fix: All requests go through a local proxy path /api/gemini/...
 *   • Dev  → Vite's devServer.proxy rewrites to googleapis.com (vite.config.js)
 *   • Prod → netlify/functions/gemini.js (or vercel/api/gemini.js) acts as relay
 *
 * How to get a FREE Gemini key (never expires, 1500 req/day):
 *   https://aistudio.google.com/apikey  →  Create API key  →  paste in app
 */

const MODEL        = 'gemini-2.0-flash';
// In dev Vite proxies /api/gemini → googleapis.com/v1beta/models
// In prod your serverless function handles the same path
const PROXY_BASE   = '/api/gemini';

// ─────────────────────────────────────────────────────────────────────────────
// Core fetch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * callAI — send a conversation to Gemini, return the text reply.
 *
 * @param {string} systemPrompt   Coach persona / context (can be empty string)
 * @param {Array}  history        [{role:'user'|'model', parts:[{text}]}]
 * @param {string} userMessage    The new user message
 * @param {string} apiKey         Gemini API key (AIza…)
 * @param {number} maxTokens      Max output tokens (default 512)
 */
export async function callAI(systemPrompt, history = [], userMessage, apiKey, maxTokens = 512) {
  if (!apiKey) throw new Error('NO_KEY');

  const contents = [
    ...history,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const body = {
    // system_instruction must be omitted entirely if empty (Gemini rejects null)
    ...(systemPrompt ? { system_instruction: { parts: [{ text: systemPrompt }] } } : {}),
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.75,
    },
    // Safety settings relaxed so chess analysis isn't blocked by "violence" heuristics
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  // Key goes as query param — proxy strips it before forwarding so it never
  // appears in the browser's Network tab origin headers
  const url = `${PROXY_BASE}/${MODEL}:generateContent?key=${apiKey}`;

  let res;
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
  } catch (networkErr) {
    // Likely: proxy not running, or no internet
    throw new Error(`Network error — is the dev server running? (${networkErr.message})`);
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      msg = errJson?.error?.message || msg;
      // Surface the most common mistakes clearly
      if (res.status === 400) msg = `Bad request: ${msg} — check your API key format`;
      if (res.status === 403) msg = `API key invalid or quota exceeded (403)`;
      if (res.status === 429) msg = `Rate limit hit — slow down a little (429)`;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();

  // Handle Gemini's block / finish reasons
  const candidate = data?.candidates?.[0];
  if (!candidate) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Blocked by safety filter: ${blockReason}` : 'Empty response from Gemini');
  }
  if (candidate.finishReason === 'SAFETY') {
    throw new Error('Response blocked by Gemini safety filters');
  }

  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text content');
  return text.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert simple [{role:'user'|'assistant', content}] history
 * → Gemini format [{role:'user'|'model', parts:[{text}]}]
 */
export function toGeminiHistory(history) {
  return history.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

/** Single-shot call — no history, for quick one-off comments */
export async function quickComment(prompt, apiKey, maxTokens = 120) {
  return callAI('', [], prompt, apiKey, maxTokens);
}

/**
 * Validate a Gemini key with a minimal 5-token request.
 * Returns { ok: true } or { ok: false, error: string }
 */
export async function validateKey(apiKey) {
  if (!apiKey?.startsWith('AIza')) {
    return { ok: false, error: 'Key should start with "AIza"' };
  }
  try {
    await callAI('', [], 'Reply with the single word: ok', apiKey, 5);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** Coach Magnus system prompt with optional game context */
export function coachSystemPrompt(gameContext = '') {
  return [
    'You are Coach Magnus, a friendly expert chess coach.',
    'Style: encouraging, precise, specific. Use chess notation (e4, Nf3, etc).',
    'Keep answers SHORT — 2-3 sentences unless deep analysis is requested.',
    'Never use markdown headers or bullet lists unless explicitly asked.',
    'Light use of chess emoji ♟♔♕ is fine.',
    gameContext ? `\nCurrent game context:\n${gameContext}` : '',
  ].filter(Boolean).join('\n');
}
