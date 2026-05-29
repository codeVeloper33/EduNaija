/* ============================================
   EduNaija — ui.js
   Sidebar, hamburger, toast, profile dropdown,
   notifications, topic picker, overlays
   ============================================ */

// ── SIDEBAR ──
const Sidebar = {
  open() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('hamburger')?.classList.add('open');
    document.getElementById('overlay')?.classList.add('show');
  },
  close() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('hamburger')?.classList.remove('open');
    document.getElementById('overlay')?.classList.remove('show');
  },
  toggle() {
    const isOpen = document.getElementById('sidebar')?.classList.contains('open');
    isOpen ? this.close() : this.open();
  }
};

window.toggleSidebar = () => Sidebar.toggle();
window.closeSidebar  = () => Sidebar.close();

// Close sidebar on overlay click
document.getElementById('overlay')?.addEventListener('click', () => Sidebar.close());

// ── PROFILE DROPDOWN ──
const ProfileDropdown = {
  toggle() {
    document.getElementById('profile-dropdown')?.classList.toggle('show');
  },
  close() {
    document.getElementById('profile-dropdown')?.classList.remove('show');
  }
};

window.toggleProfile = () => ProfileDropdown.toggle();

// Close on outside click
document.addEventListener('click', e => {
  const wrap = document.querySelector('.profile-wrap');
  if (wrap && !wrap.contains(e.target)) ProfileDropdown.close();
});

// ── TOAST ──
const Toast = {
  show(msg, duration = 3000) {
    const container = document.getElementById('toasts');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }
};

window.showToast = (msg, duration) => Toast.show(msg, duration);

// ── NOTIFICATIONS ──
const Notifications = {
  _items: [],

  add(title, body, type = 'info') {
    const item = {
      id: Date.now(),
      title,
      body,
      type,
      read: false,
      time: new Date().toISOString()
    };
    this._items.unshift(item);
    this._updateBadge();
    return item;
  },

  markAllRead() {
    this._items.forEach(i => i.read = true);
    this._updateBadge();
  },

  _updateBadge() {
    const dot = document.getElementById('notifDot');
    const unread = this._items.filter(i => !i.read).length;
    if (dot) dot.style.display = unread > 0 ? 'block' : 'none';
  },

  render() {
    // TODO: render notification panel
    this.markAllRead();
  }
};

window.Notifications = Notifications;
window.openNotifications = () => Notifications.render();

// ── SET USER UI (called after login) ──
function setUserUI(profile) {
  if (!profile) return;

  const initial = (profile.name || '?')[0].toUpperCase();
  const plan    = profile.plan || 'free';

  // Avatar / initials
  document.querySelectorAll('.profile-btn, #pd-avatar').forEach(el => {
    el.textContent = initial;
  });

  // Profile dropdown
  const pdName  = document.getElementById('pd-name');
  const pdEmail = document.getElementById('pd-email');
  const pdClass = document.getElementById('pd-class');
  const pdPlan  = document.getElementById('pd-plan');
  if (pdName)  pdName.textContent  = profile.name  || 'Student';
  if (pdEmail) pdEmail.textContent = profile.email || '';
  if (pdClass) pdClass.textContent = profile.class || '—';
  if (pdPlan) {
    pdPlan.textContent  = plan === 'premium' ? 'Premium ✨' : 'Free';
    pdPlan.className    = `plan-badge ${plan}`;
  }

  // Settings page
  const settingsEmail = document.getElementById('settings-email');
  const settingsPlan  = document.getElementById('settings-plan');
  if (settingsEmail) settingsEmail.textContent = profile.email || '';
  if (settingsPlan) {
    settingsPlan.textContent = plan === 'premium' ? 'Premium' : 'Free';
    settingsPlan.className   = `plan-badge ${plan}`;
  }

  // Welcome name in chat
  const welcomeName = document.getElementById('welcome-name');
  if (welcomeName) welcomeName.textContent = (profile.name || 'Student').split(' ')[0];

  // Questions remaining
  updateQuestionCount(profile.questionsToday || 0, plan === 'premium' ? 100 : 10);
}

function updateQuestionCount(used, max = 10) {
  const left = Math.max(0, max - used);
  const el   = document.getElementById('questionsLeft');
  if (el) el.textContent = left;
  const pdQ = document.getElementById('pd-questions');
  if (pdQ) pdQ.textContent = `${used} / ${max} questions today`;
}

window.UI = {
  setUserUI,
  updateQuestionCount,
  showToast: Toast.show.bind(Toast),
  closeSidebar: Sidebar.close.bind(Sidebar),
  sidebar: Sidebar,
};

// ── TOPIC PICKER ──
window.openTopicPicker = function() {
  const modal = document.getElementById('topicModal');
  if (!modal) return;
  renderTopicList();
  modal.classList.add('show');
};
window.closeTopicPicker = function() {
  document.getElementById('topicModal')?.classList.remove('show');
};

function renderTopicList(filter = '') {
  const container = document.getElementById('topicList');
  if (!container) return;
  const topics = (window.allTopics || []).filter(t =>
    t.topic.toLowerCase().includes(filter.toLowerCase())
  );
  container.innerHTML = topics.map(t => `
    <div class="topic-list-item" onclick="window.Chat?.selectTopic('${t.id}')">
      <span class="topic-list-icon">📖</span>
      <span>${t.topic}</span>
    </div>
  `).join('') || '<div style="padding:16px;color:var(--text-muted);text-align:center">No topics found</div>';
}

window.filterTopics = (val) => renderTopicList(val);

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown', e => {
  // Escape closes any open modal/sidebar
  if (e.key === 'Escape') {
    Sidebar.close();
    ProfileDropdown.close();
    document.querySelectorAll('.modal-backdrop.show').forEach(m => m.classList.remove('show'));
  }
  // Cmd/Ctrl + K — focus chat input
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('chat-input')?.focus();
  }
});

// ── AUTO-RESIZE TEXTAREA ──
window.autoResize = function(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
};
