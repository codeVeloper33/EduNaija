/* ============================================
   EduNaija — settings.js
   Theme, font, speech language, haptic,
   notifications, privacy, billing, profile edit
   ============================================ */

import {
  getFirestore,
  doc,
  updateDoc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const db   = getFirestore();
const auth = getAuth();

// ── DEFAULT SETTINGS ──
const DEFAULTS = {
  theme:         'dark',     // dark | light | system
  font:          'default',  // default | serif | mono | system
  speechLang:    'en-NG',
  haptic:        true,
  notifications: true,
};

// In-memory settings (loaded from Firestore on login)
let _settings = { ...DEFAULTS };

// ── LOAD FROM FIRESTORE ──
async function load() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      _settings = { ...DEFAULTS, ...(data.settings || {}) };
    }
  } catch (e) {
    console.error('Settings load error:', e);
  }

  applyAll();
  renderUI();
}

// ── SAVE TO FIRESTORE ──
async function save(key, value) {
  _settings[key] = value;
  const user = auth.currentUser;
  if (!user) return;

  try {
    await updateDoc(doc(db, 'users', user.uid), {
      [`settings.${key}`]: value
    });
  } catch (e) {
    console.error('Settings save error:', e);
  }
}

// ── APPLY ALL SETTINGS TO DOM ──
function applyAll() {
  applyTheme(_settings.theme);
  applyFont(_settings.font);
}

// ── THEME ──
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  _settings.theme = theme;

  // Update UI
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === theme);
  });
}

window.setTheme = async function(theme) {
  applyTheme(theme);
  await save('theme', theme);
  window.UI?.showToast(`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
};

// ── FONT ──
function applyFont(font) {
  document.documentElement.setAttribute('data-font', font);
  _settings.font = font;

  document.querySelectorAll('.font-option').forEach(el => {
    el.classList.toggle('active', el.dataset.font === font);
  });

  const fontValueEl = document.getElementById('settings-font-value');
  if (fontValueEl) {
    const labels = { default: 'Default', serif: 'Serif', mono: 'Monospace', system: 'System' };
    fontValueEl.textContent = labels[font] || font;
  }
}

window.setFont = async function(font) {
  applyFont(font);
  await save('font', font);
  window.UI?.showToast('Font updated');
};

// ── SPEECH LANGUAGE ──
window.setSpeechLang = async function(lang) {
  _settings.speechLang = lang;
  await save('speechLang', lang);
  if (window.Voice) window.Voice.setLang(lang);

  const el = document.getElementById('settings-speech-value');
  if (el) el.textContent = getLangLabel(lang);
  window.UI?.showToast('Speech language updated');
};

function getLangLabel(code) {
  const map = {
    'en-NG': 'English (Nigeria)',
    'en-US': 'English (US)',
    'en-GB': 'English (UK)',
    'yo-NG': 'Yoruba',
    'ha-NG': 'Hausa',
    'ig-NG': 'Igbo',
  };
  return map[code] || code;
}

// ── HAPTIC FEEDBACK ──
window.toggleHaptic = async function(checkbox) {
  const val = checkbox.checked;
  _settings.haptic = val;
  await save('haptic', val);
};

export function hapticFeedback(style = 'light') {
  if (!_settings.haptic) return;
  if ('vibrate' in navigator) {
    const patterns = { light: [10], medium: [20], heavy: [30, 10, 30] };
    navigator.vibrate(patterns[style] || [10]);
  }
}

// ── NOTIFICATIONS ──
window.toggleNotifications = async function(checkbox) {
  const val = checkbox.checked;
  _settings.notifications = val;
  await save('notifications', val);

  if (val) {
    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }
};

// ── RENDER SETTINGS UI ──
function renderUI() {
  // Theme options
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === _settings.theme);
  });

  // Font options
  document.querySelectorAll('.font-option').forEach(el => {
    el.classList.toggle('active', el.dataset.font === _settings.font);
  });
  const fontValueEl = document.getElementById('settings-font-value');
  if (fontValueEl) {
    const labels = { default: 'Default', serif: 'Serif', mono: 'Monospace', system: 'System' };
    fontValueEl.textContent = labels[_settings.font] || _settings.font;
  }

  // Speech language
  const speechEl = document.getElementById('settings-speech-value');
  if (speechEl) speechEl.textContent = getLangLabel(_settings.speechLang);

  // Haptic toggle
  const hapticToggle = document.getElementById('haptic-toggle');
  if (hapticToggle) hapticToggle.checked = _settings.haptic;

  // Notifications toggle
  const notifToggle = document.getElementById('notif-toggle');
  if (notifToggle) notifToggle.checked = _settings.notifications;

  // Theme value in settings item
  const themeValueEl = document.getElementById('settings-theme-value');
  if (themeValueEl) {
    const labels = { dark: 'Dark', light: 'Light', system: 'System' };
    themeValueEl.textContent = labels[_settings.theme] || _settings.theme;
  }
}

// ── OPEN / CLOSE SETTINGS PAGE ──
window.openSettings = function() {
  window.showPage('settings-page');
  renderUI();
};
window.closeSettings = function() {
  window.showPage('chat-ui');
};

// ── PRIVACY ──
window.openPrivacy = function() {
  window.UI?.showToast('Privacy policy coming soon');
};

// ── SHARED LINKS ──
window.openSharedLinks = function() {
  window.UI?.showToast('Shared links coming soon');
};

// ── USAGE STATS ──
async function loadUsageStats() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return;
    const data = snap.data();
    const used = data.questionsToday || 0;
    const max  = data.plan === 'premium' ? 100 : 10;
    const pct  = Math.min(100, Math.round((used / max) * 100));

    const usedEl = document.getElementById('stats-used');
    const maxEl  = document.getElementById('stats-max');
    const fillEl = document.getElementById('stats-fill');
    const totalEl = document.getElementById('stats-total');

    if (usedEl)  usedEl.textContent  = used;
    if (maxEl)   maxEl.textContent   = max;
    if (totalEl) totalEl.textContent = data.totalQuestions || 0;
    if (fillEl) {
      fillEl.style.width = pct + '%';
      fillEl.classList.toggle('danger', pct >= 90);
    }
  } catch (e) {
    console.error('loadUsageStats:', e);
  }
}

window.Settings = {
  load,
  applyAll,
  get: (key) => _settings[key],
  getAll: () => ({ ..._settings }),
  loadUsageStats,
};

// Init on page open
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme from localStorage immediately (before Firestore loads)
  // to prevent flash of wrong theme
  const savedTheme = localStorage.getItem('edu-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
});
