/**
 * EduNaija Cloudflare Worker — Main Entry
 * Routes: POST /api/chat  →  AI handler
 *         GET  /api/ping  →  health check
 */

import { verifyFirebaseToken } from './auth.js';
import { checkRateLimit, incrementUsage } from './rateLimit.js';
import { callGemini } from './gemini.js';
import { callGroq } from './groq.js';

export default {
  async fetch(request, env) {
    // ── CORS ──
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ── Health check ──
    if (url.pathname === '/api/ping') {
      return json({ status: 'ok', service: 'EduNaija Worker' }, corsHeaders);
    }

    // ── Chat endpoint ──
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env, corsHeaders);
    }

    return json({ error: 'Not found' }, corsHeaders, 404);
  }
};

async function handleChat(request, env, corsHeaders) {
  try {
    // 1. Parse body
    const body = await request.json();
    const { messages, systemPrompt, hasImages } = body;

    if (!messages || !Array.isArray(messages)) {
      return json({ error: 'Invalid request — messages array required' }, corsHeaders, 400);
    }

    // 2. Verify Firebase token
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return json({ error: 'Unauthorized — no token provided' }, corsHeaders, 401);
    }

    const userId = await verifyFirebaseToken(token, env);
    if (!userId) {
      return json({ error: 'Unauthorized — invalid token' }, corsHeaders, 401);
    }

    // 3. Check rate limit
    const limitResult = await checkRateLimit(userId, env);
    if (!limitResult.allowed) {
      return json({
        error: 'rate_limit',
        message: `Daily limit reached. You have used ${limitResult.used} of ${limitResult.max} questions today.`,
        resetAt: limitResult.resetAt
      }, corsHeaders, 429);
    }

    // 4. Try Gemini first, fall back to Groq
    let result = null;
    let usedModel = 'gemini';

    try {
      result = await callGemini(messages, systemPrompt, hasImages, env);
    } catch (geminiErr) {
      if (geminiErr.status === 429) {
        // Gemini rate limited — switch to Groq silently
        usedModel = 'groq';
        result = await callGroq(messages, systemPrompt, env);
      } else {
        throw geminiErr;
      }
    }

    // 5. Increment usage after successful response
    await incrementUsage(userId, env);

    // 6. Return response
    return json({
      reply: result.reply,
      model: usedModel,
      usage: {
        used: limitResult.used + 1,
        max: limitResult.max,
        remaining: limitResult.max - limitResult.used - 1
      }
    }, corsHeaders);

  } catch (err) {
    console.error('Worker error:', err);
    return json({
      error: 'server_error',
      message: err.message || 'Something went wrong'
    }, corsHeaders, 500);
  }
}

// ── Helper ──
function json(data, headers = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}
