/* ============================================
   EduNaija — chat.js
   Send message, render bubbles, typing indicator,
   cancel request, Worker API call, suggestion chips
   ============================================ */

import { State, getIdToken, WORKER_URL } from './app.js';
import { RAG } from './rag.js';
import { Upload } from './upload.js';

// ── STATE ──
let chatHistory    = [];   // [{role, content}] sent to Worker
let isLoading      = false;
let _abortCtrl     = null;
let _typingTimer   = null;
let currentTopic   = null;

// ── SEND MESSAGE ──
async function sendMsg() {
  const input  = document.getElementById('chat-input');
  const text   = input?.value.trim() || '';
  const images = Upload.getPending();

  if ((!text && images.length === 0) || isLoading) return;

  // Remove welcome screen on first message
  const ws = document.getElementById('welcomeScreen');
  if (ws) {
    ws.remove();
    document.getElementById('chatBody')?.classList.remove('centered');
    window.Sessions?.startNew(text || '📷 Image');
  }

  // Build content — multipart if images present
  let userContent;
  if (images.length > 0) {
    userContent = [
      ...images.map(img => ({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.base64}` }
      })),
      ...(text ? [{ type: 'text', text }] : [])
    ];
  } else {
    userContent = text;
  }

  // Render user message
  addMsg('user', text, null, images);
  chatHistory.push({ role: 'user', content: userContent });

  // Clear input + images
  if (input) { input.value = ''; input.style.height = 'auto'; }
  Upload.clear();

  // Show typing indicator
  const typingEl = addTyping();
  const reqStart  = Date.now();
  setLoading(true);
  _abortCtrl = new AbortController();

  try {
    const token  = await getIdToken();
    const system = buildSystemPrompt();

    const res = await fetch(`${WORKER_URL}/api/chat`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      signal: _abortCtrl.signal,
      body: JSON.stringify({
        messages:     chatHistory.slice(-10),
        systemPrompt: system,
        hasImages:    images.length > 0
      })
    });

    const elapsed = ((Date.now() - reqStart) / 1000).toFixed(1);
    clearTyping(typingEl);

    const data = await res.json();

    if (!res.ok) {
      handleAPIError(data, res.status);
    } else {
      const reply = data.reply;
      chatHistory.push({ role: 'assistant', content: reply });

      addMsg('ai', reply, elapsed);
      window.Sessions?.save();

      // Update question count
      if (data.usage) {
        window.UI?.updateQuestionCount(data.usage.used, data.usage.max);
      }
    }

  } catch (err) {
    clearTyping(typingEl);
    if (err.name === 'AbortError') {
      addMsg('ai', '🚫 Request cancelled.');
    } else {
      addMsg('ai', '⚠️ Connection error. Check your internet and try again.');
    }
  }

  _abortCtrl = null;
  setLoading(false);
  scrollBottom();
  window.Sessions?.save();
  window.Settings?.hapticFeedback?.('light');
}
window.sendMsg = sendMsg;

// ── CANCEL ──
function cancelRequest() {
  _abortCtrl?.abort();
  _abortCtrl = null;
}
window.cancelRequest = cancelRequest;

// ── SYSTEM PROMPT ──
function buildSystemPrompt() {
  const context = RAG.getContext(
    chatHistory.filter(m => m.role === 'user').slice(-1)[0]?.content || ''
  );

  return `You are EduNaija, an AI Physics tutor for Nigerian SSCE/WAEC/NECO students, trained on "Hidden Facts in SSCE Physics" by Otumudia Publishers.

Answer EXACTLY like the Hidden Facts textbook:
- Give direct, concise definitions first
- Use WAEC/NECO exam format and style
- State formulas clearly (e.g. V = IR)
- Give brief worked examples for calculations
- Use simple English a Nigerian SS student understands
- For calculations: state formula → substitute values → evaluate
- Be encouraging but brief
- Format key terms in **bold**
- Format formulas in \`code\` style

${context ? `TEXTBOOK CONTENT:\n${context}` : ''}
Current topic: ${currentTopic?.topic || 'General Physics'}`;
}

// ── ERROR HANDLER ──
function handleAPIError(data, status) {
  const code = data.error;
  const msg  = data.message || '';

  if (code === 'rate_limit' || status === 429) {
    const resetTime = data.resetAt
      ? ` Resets at ${new Date(data.resetAt).toLocaleTimeString()}.`
      : '';
    addMsg('ai',
      `⏳ You've used all your questions for today.${resetTime}\n\nCome back tomorrow or upgrade to **Premium** for 100 questions/day! 🚀`
    );
    // Show limit banner
    showLimitBanner();
  } else if (status === 401) {
    addMsg('ai', '🔑 Session expired. Please sign in again.');
    setTimeout(() => window.doLogout?.(), 2000);
  } else if (status === 400) {
    addMsg('ai', `⚠️ Invalid request: ${msg}`);
  } else {
    addMsg('ai', `⚠️ Something went wrong (${status}). Please try again.`);
  }
}

function showLimitBanner() {
  const body = document.getElementById('chatBody');
  if (!body || document.getElementById('limitBanner')) return;
  const banner = document.createElement('div');
  banner.id        = 'limitBanner';
  banner.className = 'limit-banner';
  banner.innerHTML = `You've used all your free questions today. <strong>Upgrade to Premium</strong> for 100 questions/day! 🚀`;
  body.appendChild(banner);
  scrollBottom();
}

// ── ADD MESSAGE ──
function addMsg(role, text, responseTime, images) {
  const body = document.getElementById('chatBody');
  if (!body) return;

  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;

  // AI label
  if (role === 'ai') {
    const lbl = document.createElement('div');
    lbl.className = 'msg-label';
    const timeTag = responseTime
      ? ` · <span style="color:var(--gold)">${responseTime}s</span>`
      : '';
    lbl.innerHTML = `<span class="msg-dot"></span> EduNaija AI${timeTag}`;
    wrap.appendChild(lbl);
  }

  // Image thumbnails
  if (images?.length > 0) {
    images.forEach(img => {
      const im = document.createElement('img');
      im.src       = img.dataUrl || img;
      im.className = 'msg-img';
      im.alt       = 'attached image';
      wrap.appendChild(im);
    });
  }

  // Text bubble
  if (text) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML  = formatText(text);
    wrap.appendChild(bubble);
  }

  body.appendChild(wrap);

  // Track for session persistence
  window.Sessions?.trackMessage({ role, text: text || '', responseTime, images });

  scrollBottom();
  return wrap;
}
window.addMsg = addMsg;

// ── TYPING INDICATOR ──
function addTyping() {
  const body = document.getElementById('chatBody');
  if (!body) return null;

  const wrap = document.createElement('div');
  wrap.className = 'msg ai';
  wrap.id        = 'typingMsg';

  const lbl = document.createElement('div');
  lbl.className = 'msg-label';
  lbl.innerHTML = '<span class="msg-dot"></span> EduNaija AI';
  wrap.appendChild(lbl);

  const t = document.createElement('div');
  t.className = 'typing-wrap';
  t.innerHTML = `
    <div class="typing-dots">
      <div class="td"></div><div class="td"></div><div class="td"></div>
    </div>
    <div class="typing-timer" id="typingTimer"><span>0.0</span>s</div>`;
  wrap.appendChild(t);
  body.appendChild(wrap);
  scrollBottom();

  const start = Date.now();
  _typingTimer = setInterval(() => {
    const el = document.getElementById('typingTimer');
    if (el) el.innerHTML = `<span>${((Date.now() - start) / 1000).toFixed(1)}</span>s`;
  }, 100);

  return wrap;
}

function clearTyping(el) {
  if (_typingTimer) { clearInterval(_typingTimer); _typingTimer = null; }
  el?.remove();
}

// ── LOADING STATE ──
function setLoading(loading) {
  isLoading = loading;
  const sendBtn   = document.getElementById('sendBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  if (sendBtn)   sendBtn.disabled = loading;
  if (cancelBtn) cancelBtn.classList.toggle('visible', loading);
}

// ── FORMAT TEXT ──
function formatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g,     '<span class="formula">$1</span>')
    .replace(/\n\n/g,          '<br><br>')
    .replace(/\n/g,            '<br>');
}
window.formatText = formatText;

// ── SCROLL ──
function scrollBottom() {
  const b = document.getElementById('chatBody');
  if (b) b.scrollTop = b.scrollHeight;
}

// ── TOPIC SELECTION ──
function selectTopic(topicId) {
  const topic = (window.allTopics || []).find(t => t.id === topicId);
  if (!topic) return;
  currentTopic = topic;

  // Update topic pill in top bar
  const pill = document.getElementById('topicPill');
  if (pill) pill.textContent = `📖 ${topic.topic}`;

  // Add badge in chat
  const body = document.getElementById('chatBody');
  if (body) {
    const badge = document.createElement('div');
    badge.className = 'topic-badge';
    badge.textContent = `📖 Now studying: ${topic.topic}`;
    body.appendChild(badge);
    scrollBottom();
  }

  window.closeTopicPicker?.();
  window.UI?.showToast(`Topic: ${topic.topic}`);
}
window.selectTopicById = selectTopic;

// ── SUGGESTION CHIP ──
window.usePrompt = function(el) {
  const strong = el.querySelector('.pc-text strong');
  const full   = el.querySelector('.pc-text');
  const text   = full?.textContent?.replace(strong?.textContent || '', '').trim() || '';
  const input  = document.getElementById('chat-input');
  if (input) {
    input.value = text;
    window.autoResize?.(input);
    sendMsg();
  }
};

// ── NEW CHAT / RESET ──
function reset() {
  chatHistory  = [];
  currentTopic = null;

  const body = document.getElementById('chatBody');
  if (!body) return;
  body.className = 'chat-body centered';

  const name = State.profile?.name?.split(' ')[0] || 'Student';
  body.innerHTML = `
    <div class="welcome-screen" id="welcomeScreen">
      <div class="welcome-icon">🎓</div>
      <h2 class="welcome-title">Hello, <span id="welcome-name">${name}</span>!</h2>
      <p class="welcome-sub">What would you like to learn today? Ask me anything from your Physics syllabus.</p>
      <div class="prompt-grid">
        <div class="prompt-card" onclick="usePrompt(this)">
          <div class="pc-icon">⚡</div>
          <div class="pc-text"><strong>Ohm's Law</strong>What is Ohm's Law and its formula?</div>
        </div>
        <div class="prompt-card" onclick="usePrompt(this)">
          <div class="pc-icon">🌊</div>
          <div class="pc-text"><strong>Types of Waves</strong>Explain types of waves with examples</div>
        </div>
        <div class="prompt-card" onclick="usePrompt(this)">
          <div class="pc-icon">🍎</div>
          <div class="pc-text"><strong>Newton's Laws</strong>State Newton's Laws of Motion</div>
        </div>
        <div class="prompt-card" onclick="usePrompt(this)">
          <div class="pc-icon">☢️</div>
          <div class="pc-text"><strong>Radioactivity</strong>What is radioactive decay?</div>
        </div>
      </div>
    </div>`;
}
window.newChat = function() {
  window.Sessions?.saveCurrentSession();
  reset();
  window.closeSidebar?.();
};

window.Chat = {
  reset,
  sendMsg,
  addMsg,
  getChatHistory: () => [...chatHistory],
  setChatHistory: (h) => { chatHistory = h; },
  getCurrentTopic: () => currentTopic,
};
