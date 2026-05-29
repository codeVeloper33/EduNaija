/**
 * EduNaija Worker — groq.js
 * Groq fallback when Gemini is rate limited
 * Uses llama-3.1-8b-instant (fast, generous free tier)
 * Note: Groq does not support images — text only fallback
 */

const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

export async function callGroq(messages, systemPrompt, env) {
  const apiKey = env.GROQ_KEY;
  if (!apiKey) throw new Error('GROQ_KEY secret not set');

  // Groq uses OpenAI format — strip images, text only
  const groqMessages = [
    { role: 'system', content: systemPrompt || 'You are EduNaija, an AI Physics tutor.' },
    ...buildGroqMessages(messages)
  ];

  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 1024,
      temperature: 0.7,
      messages: groqMessages
    })
  });

  if (res.status === 429) {
    const err = new Error('Groq rate limited');
    err.status = 429;
    throw err;
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData?.error?.message || `Groq error ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error('Empty response from Groq');

  return { reply, model: GROQ_MODEL };
}

function buildGroqMessages(messages) {
  return messages.map(msg => {
    const role = msg.role === 'assistant' ? 'assistant' : 'user';

    // Text only
    if (typeof msg.content === 'string') {
      return { role, content: msg.content };
    }

    // Extract text from multipart — skip images
    if (Array.isArray(msg.content)) {
      const textParts = msg.content
        .filter(p => p.type === 'text' && p.text)
        .map(p => p.text)
        .join('\n');
      return { role, content: textParts || '[image]' };
    }

    return { role, content: '' };
  });
}
