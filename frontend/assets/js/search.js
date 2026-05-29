/* ============================================
   EduNaija — search.js
   Search chat history and physics topics
   ============================================ */

// ── SEARCH CHAT HISTORY ──
function searchHistory(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    window.Sessions?.buildSidebar('');
    return;
  }

  const sessions = window.Sessions?.getAll() || [];

  // Search by title and message text content
  const results = sessions.filter(s => {
    if (s.title.toLowerCase().includes(q)) return true;
    return (s.messages || []).some(m =>
      (m.text || '').toLowerCase().includes(q)
    );
  });

  // Render filtered results
  const container = document.getElementById('chat-history');
  if (!container) return;

  const label = container.querySelector('.sidebar-section-label');
  container.innerHTML = '';
  if (label) container.appendChild(label);

  if (results.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:12px 10px;font-size:13px;color:var(--text-muted);';
    empty.textContent = `No chats found for "${query}"`;
    container.appendChild(empty);
    return;
  }

  results.forEach(s => {
    // Find matching message snippet
    const matchingMsg = (s.messages || []).find(m =>
      (m.text || '').toLowerCase().includes(q)
    );
    const snippet = matchingMsg
      ? highlight(matchingMsg.text.slice(0, 80) + '…', q)
      : null;

    const el = document.createElement('div');
    el.className = 'chat-item';
    el.innerHTML = `
      <span class="chat-item-dot"></span>
      <div style="flex:1;overflow:hidden;min-width:0">
        <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.title}</div>
        ${snippet ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${snippet}</div>` : ''}
      </div>
    `;
    el.onclick = () => window.Sessions?.load(s.id);
    container.appendChild(el);
  });
}

// ── HIGHLIGHT MATCH ──
function highlight(text, query) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(
    new RegExp(`(${escaped})`, 'gi'),
    '<mark style="background:var(--gold-glow);color:var(--gold);border-radius:2px">$1</mark>'
  );
}

// ── SEARCH TOPICS ──
function searchTopics(query) {
  return window.RAG?.searchTopics(query) || [];
}

// ── GLOBAL SEARCH (topics + chats) ──
function globalSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { topics: [], chats: [] };

  return {
    topics: searchTopics(q),
    chats:  (window.Sessions?.getAll() || []).filter(s =>
      s.title.toLowerCase().includes(q)
    )
  };
}

export const Search = {
  searchHistory,
  searchTopics,
  globalSearch,
  highlight,
};

window.Search     = Search;
window.filterChats = (val) => searchHistory(val);
