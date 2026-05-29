/* ============================================
   EduNaija — session.js
   Chat sessions — create, save, load, delete
   Firestore persistence + sidebar rendering
   ============================================ */

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const db   = getFirestore();
const auth = getAuth();

// ── STATE ──
let _sessions       = [];   // [{id, title, history, messages, updatedAt}]
let _activeId       = null;
let _displayMessages = [];  // [{role, text, images, responseTime}]

// ── START NEW SESSION ──
function startNew(firstMessage) {
  saveCurrentSession();

  const id    = Date.now();
  const title = firstMessage.length > 40
    ? firstMessage.slice(0, 40) + '…'
    : firstMessage;

  const session = { id, title, history: [], messages: [], updatedAt: id };
  _sessions.unshift(session);
  _activeId        = id;
  _displayMessages = session.messages;

  _saveToFirestore(session);
  buildSidebar();
  return id;
}

// ── TRACK MESSAGE (called by chat.js addMsg) ──
function trackMessage(msg) {
  // Store only dataUrl (not full base64) to keep size small
  const entry = {
    role:         msg.role,
    text:         msg.text || '',
    responseTime: msg.responseTime || null,
    images:       (msg.images || []).map(i =>
      typeof i === 'string' ? i : (i.dataUrl || '__img__')
    )
  };
  _displayMessages.push(entry);
}

// ── SAVE CURRENT SESSION ──
function saveCurrentSession() {
  if (_activeId === null) return;
  const session = _sessions.find(s => s.id === _activeId);
  if (!session) return;

  session.history  = window.Chat?.getChatHistory() || [];
  session.messages = [..._displayMessages];
  session.updatedAt = Date.now();

  _saveToFirestore(session);
}

// ── LOAD SESSION ──
function loadSession(id) {
  saveCurrentSession();

  const session = _sessions.find(s => s.id === id);
  if (!session) return;

  _activeId        = id;
  _displayMessages = [...(session.messages || [])];

  // Restore chat history for API
  window.Chat?.setChatHistory(session.history || []);

  // Re-render messages in DOM
  const body = document.getElementById('chatBody');
  if (body) {
    body.className = 'chat-body';
    body.innerHTML = '';
    _displayMessages.forEach(msg => _renderStoredMsg(msg));
  }

  buildSidebar();
  window.closeSidebar?.();

  const b = document.getElementById('chatBody');
  if (b) b.scrollTop = b.scrollHeight;
}

// ── DELETE SESSION ──
async function deleteSession(id, e) {
  e?.stopPropagation();

  _sessions = _sessions.filter(s => s.id !== id);

  // If deleting active session → new chat
  if (_activeId === id) {
    _activeId        = null;
    _displayMessages = [];
    window.newChat?.();
  }

  buildSidebar();
  await _deleteFromFirestore(id);
  window.UI?.showToast('Chat deleted');
}
window.deleteSession = deleteSession;

// ── CLEAR ALL (on logout) ──
function clear() {
  _sessions        = [];
  _activeId        = null;
  _displayMessages = [];
  buildSidebar();
}

// ── LOAD FROM FIRESTORE ──
async function loadFromFirestore() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const q    = query(
      collection(db, 'chats', user.uid, 'sessions'),
      orderBy('updatedAt', 'desc')
    );
    const snap = await getDocs(q);

    snap.forEach(d => {
      const data = d.data();
      if (!_sessions.find(s => s.id === data.id)) {
        _sessions.push(data);
      }
    });

    _sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    buildSidebar();
  } catch (e) {
    console.error('loadFromFirestore:', e);
  }
}

// ── SAVE TO FIRESTORE ──
async function _saveToFirestore(session) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // Strip large image dataUrls — store placeholder instead
    const safeMessages = (session.messages || []).map(m => ({
      role:         m.role,
      text:         m.text || '',
      responseTime: m.responseTime || null,
      images:       (m.images || []).map(url =>
        url && url.startsWith('data:') ? '__img__' : (url || '')
      )
    }));

    await setDoc(
      doc(db, 'chats', user.uid, 'sessions', String(session.id)),
      {
        id:         session.id,
        title:      session.title,
        history:    session.history  || [],
        messages:   safeMessages,
        updatedAt:  session.updatedAt || Date.now()
      }
    );
  } catch (e) {
    console.error('_saveToFirestore:', e);
  }
}

// ── DELETE FROM FIRESTORE ──
async function _deleteFromFirestore(id) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'chats', user.uid, 'sessions', String(id)));
  } catch (e) {
    console.error('_deleteFromFirestore:', e);
  }
}

// ── RE-RENDER STORED MESSAGE ──
function _renderStoredMsg(msg) {
  const imgs = (msg.images || []).map(url => ({
    dataUrl: url === '__img__'
      ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="8" fill="%231f1f1f"/><text x="50%" y="55%" font-size="22" text-anchor="middle" fill="%23888">🖼️</text></svg>'
      : url
  }));
  window.addMsg?.(msg.role, msg.text, msg.responseTime, imgs.length ? imgs : null);
}

// ── BUILD SIDEBAR CHAT LIST ──
function buildSidebar(filter = '') {
  const container = document.getElementById('chat-history');
  if (!container) return;

  // Keep section label if it exists
  const label = container.querySelector('.sidebar-section-label');
  container.innerHTML = '';
  if (label) container.appendChild(label);

  const filtered = _sessions.filter(s =>
    s.title.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:12px 10px;font-size:13px;color:var(--text-muted);';
    empty.textContent = filter ? 'No chats match your search' : 'No chats yet';
    container.appendChild(empty);
    return;
  }

  filtered.forEach(s => {
    const el = document.createElement('div');
    el.className = 'chat-item' + (s.id === _activeId ? ' active' : '');
    el.innerHTML = `
      <span class="chat-item-dot"></span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.title}</span>
      <button class="chat-item-del" onclick="deleteSession(${s.id}, event)" 
        title="Delete" style="opacity:0;font-size:12px;padding:2px 5px;border-radius:4px;background:var(--bg4);color:var(--text-muted);transition:var(--transition)">✕</button>
    `;
    // Show delete on hover
    el.addEventListener('mouseenter', () => {
      el.querySelector('.chat-item-del').style.opacity = '1';
    });
    el.addEventListener('mouseleave', () => {
      el.querySelector('.chat-item-del').style.opacity = '0';
    });
    el.addEventListener('click', () => loadSession(s.id));
    container.appendChild(el);
  });
}

window.filterChats = (val) => buildSidebar(val);

window.Sessions = {
  startNew,
  trackMessage,
  save:               saveCurrentSession,
  saveCurrentSession,
  load:               loadSession,
  delete:             deleteSession,
  clear,
  loadFromFirestore,
  buildSidebar,
  getActive:          () => _activeId,
  getAll:             () => [..._sessions],
};
