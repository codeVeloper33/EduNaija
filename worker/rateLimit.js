/**
 * EduNaija Worker — rateLimit.js
 * Per-user daily question limit stored in Cloudflare KV
 * Resets at midnight UTC every day
 */

const FREE_DAILY_LIMIT = 10;
const PREMIUM_DAILY_LIMIT = 100;

function getTodayKey(userId) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `ratelimit:${userId}:${today}`;
}

function getSecondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.floor((midnight - now) / 1000);
}

export async function checkRateLimit(userId, env) {
  const kv = env.RATE_LIMIT_KV;
  if (!kv) {
    // KV not configured — allow all (dev mode)
    console.warn('RATE_LIMIT_KV not configured — skipping rate limit');
    return { allowed: true, used: 0, max: FREE_DAILY_LIMIT, resetAt: null };
  }

  const key = getTodayKey(userId);
  const raw = await kv.get(key);
  const used = raw ? parseInt(raw) : 0;

  // Check if user is premium (stored in KV as plan:userId)
  const planRaw = await kv.get(`plan:${userId}`);
  const isPremium = planRaw === 'premium';
  const max = isPremium ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;

  const resetAt = new Date();
  resetAt.setUTCHours(24, 0, 0, 0);

  return {
    allowed: used < max,
    used,
    max,
    remaining: Math.max(0, max - used),
    isPremium,
    resetAt: resetAt.toISOString()
  };
}

export async function incrementUsage(userId, env) {
  const kv = env.RATE_LIMIT_KV;
  if (!kv) return;

  const key = getTodayKey(userId);
  const raw = await kv.get(key);
  const current = raw ? parseInt(raw) : 0;
  const ttl = getSecondsUntilMidnight();

  // Store with TTL so it auto-deletes at midnight
  await kv.put(key, String(current + 1), { expirationTtl: ttl });
}

export async function getUserUsage(userId, env) {
  const kv = env.RATE_LIMIT_KV;
  if (!kv) return { used: 0, max: FREE_DAILY_LIMIT };

  const key = getTodayKey(userId);
  const raw = await kv.get(key);
  const used = raw ? parseInt(raw) : 0;

  const planRaw = await kv.get(`plan:${userId}`);
  const isPremium = planRaw === 'premium';
  const max = isPremium ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;

  return { used, max, remaining: Math.max(0, max - used), isPremium };
}

export async function setUserPlan(userId, plan, env) {
  // plan: 'free' | 'premium'
  const kv = env.RATE_LIMIT_KV;
  if (!kv) return;
  if (plan === 'premium') {
    await kv.put(`plan:${userId}`, 'premium');
  } else {
    await kv.delete(`plan:${userId}`);
  }
}
