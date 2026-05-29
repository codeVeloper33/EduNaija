/**
 * EduNaija Worker — gemini.js
 * Handles all Gemini API calls
 * Supports text + image (multimodal) messages
 */

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function callGemini(messages, systemPrompt, hasImages = false, env) {
  const apiKey = env.GEMINI_KEY;
  if (!apiKey) throw new Error('GEMINI_KEY secret not set');

  // Build Gemini contents array
  // messages format: [{role: 'user'|'assistant', content: string|array}]
  const contents = buildGeminiContents(messages);

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemPrompt || 'You are EduNaija, an AI Physics tutor.' }]
    },
    contents,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
      topP: 0.9
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
    ]
  };

  const res = await fetch(
    `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  );

  if (res.status === 429) {
    const err = new Error('Gemini rate limited');
    err.status = 429;
    throw err;
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData?.error?.message || `Gemini error ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();

  // Check for blocked content
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error('No response from Gemini');
  }

  if (candidate.finishReason === 'SAFETY') {
    throw new Error('Response blocked by safety filters');
  }

  const reply = candidate.content?.parts?.[0]?.text;
  if (!reply) throw new Error('Empty response from Gemini');

  return { reply, model: GEMINI_MODEL };
}

function buildGeminiContents(messages) {
  const contents = [];

  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';

    // Text only message
    if (typeof msg.content === 'string') {
      contents.push({ role, parts: [{ text: msg.content }] });
      continue;
    }

    // Multipart message (text + images)
    if (Array.isArray(msg.content)) {
      const parts = [];
      for (const part of msg.content) {
        if (part.type === 'text' && part.text) {
          parts.push({ text: part.text });
        } else if (part.type === 'image_url') {
          const url = part.image_url?.url || '';
          if (url.startsWith('data:')) {
            const commaIdx = url.indexOf(',');
            const meta = url.slice(0, commaIdx);
            const data = url.slice(commaIdx + 1);
            const mimeType = meta.replace('data:', '').replace(';base64', '');
            parts.push({ inline_data: { mime_type: mimeType, data } });
          }
        }
      }
      if (parts.length > 0) contents.push({ role, parts });
      continue;
    }
  }

  // Gemini requires conversation to start with user
  // and strictly alternate user/model
  return enforceAlternating(contents);
}

function enforceAlternating(contents) {
  const result = [];
  for (const turn of contents) {
    const last = result[result.length - 1];
    if (last && last.role === turn.role) {
      // Merge consecutive same-role turns
      last.parts.push(...turn.parts);
    } else {
      result.push({ role: turn.role, parts: [...turn.parts] });
    }
  }
  // Must start with user
  if (result.length > 0 && result[0].role !== 'user') {
    result.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
  }
  return result;
}
