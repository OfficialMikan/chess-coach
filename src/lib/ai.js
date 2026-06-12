/**
 * ai.js — Universal AI wrapper
 * Provider: Google Gemini (free, permanent, 1500 req/day)
 * Model: gemini-2.0-flash (fast, smart, free forever)
 *
 * How to get a free Gemini API key:
 *   1. Go to https://aistudio.google.com/apikey
 *   2. Sign in with any Google account
 *   3. Click "Create API key" — that's it, free forever
 */

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Core call — sends a conversation to Gemini and returns the text reply.
 * @param {string} systemPrompt  - The coach persona / context
 * @param {Array}  history       - [{role:'user'|'model', parts:[{text}]}]
 * @param {string} userMessage   - Latest user message
 * @param {string} apiKey        - Gemini API key
 * @param {number} maxTokens     - Max output tokens (default 512)
 */
export async function callAI(systemPrompt, history = [], userMessage, apiKey, maxTokens = 512) {
  if (!apiKey) throw new Error('NO_KEY');

  // Build Gemini contents array
  const contents = [
    ...history,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const body = {
    system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  };

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text.trim();
}

/**
 * Convert our simple [{role:'user'|'assistant', content}] history
 * to Gemini's [{role:'user'|'model', parts:[{text}]}] format.
 */
export function toGeminiHistory(history) {
  return history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

/**
 * The chess coach system prompt — Coach Magnus persona.
 */
export function coachSystemPrompt(gameContext = '') {
  return `You are Coach Magnus, a friendly and expert AI chess coach. You give concise, specific, actionable advice.

Your style:
- Encouraging but honest — celebrate good moves, gently correct mistakes
- Always reference specific squares and piece names (e.g. "your knight on f3", "the e5 pawn")
- Use chess notation naturally (e4, Nf3, Qxd5, etc.)
- Keep responses SHORT — 2–4 sentences for casual questions, up to 8 for deep analysis
- Never use markdown headers or bullet points unless asked
- Light use of chess emoji (♟ ♔ ♕) is fine

${gameContext ? `Current game context:\n${gameContext}` : ''}`.trim();
}

/**
 * Quick single-shot AI call — for commentary blurbs, no history needed.
 */
export async function quickComment(prompt, apiKey, maxTokens = 120) {
  return callAI('', [], prompt, apiKey, maxTokens);
}

/**
 * Validate that a Gemini key works by making a tiny test call.
 * Returns true/false.
 */
export async function validateKey(apiKey) {
  try {
    await quickComment('Say "ok" in one word.', apiKey, 5);
    return true;
  } catch {
    return false;
  }
}
