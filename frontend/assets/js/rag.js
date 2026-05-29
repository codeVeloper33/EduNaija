/* ============================================
   EduNaija — rag.js
   Retrieval-Augmented Generation
   Searches physics topics and injects
   relevant textbook content into the prompt
   ============================================ */

// ── SEARCH CONFIG ──
const MAX_CONTEXT_CHARS = 3000;
const MIN_SCORE         = 1;

// ── STOPWORDS (ignored in scoring) ──
const STOPWORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could',
  'should','may','might','shall','can','what','how','why',
  'when','where','who','which','that','this','these','those',
  'it','its','i','me','my','we','our','you','your','he','she',
  'they','their','and','or','but','if','in','on','at','to',
  'for','of','with','by','from','about','into','through','during',
  'explain','describe','define','state','give','list','find'
]);

// ── MAIN: GET CONTEXT FOR A QUERY ──
function getContext(query) {
  const topics = window.allTopics || [];
  if (!topics.length || !query) return null;

  const queryText = typeof query === 'string'
    ? query
    : (Array.isArray(query)
        ? query.filter(c => c.type === 'text').map(c => c.text).join(' ')
        : '');

  if (!queryText.trim()) return null;

  const scored = topics.map(t => ({
    ...t,
    score: scoreMatch(queryText.toLowerCase(), t)
  }));

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  if (best.score < MIN_SCORE) return null;

  // Return top match + partial second match if scores are close
  let context = `[${best.topic}]\n${(best.content || '').slice(0, MAX_CONTEXT_CHARS)}`;

  const second = scored[1];
  if (second && second.score >= MIN_SCORE && second.score >= best.score * 0.6) {
    const remaining = MAX_CONTEXT_CHARS - context.length;
    if (remaining > 200) {
      context += `\n\n[${second.topic}]\n${(second.content || '').slice(0, remaining)}`;
    }
  }

  return context;
}

// ── SCORE A TOPIC AGAINST A QUERY ──
function scoreMatch(queryLower, topic) {
  const topicName    = (topic.topic    || '').toLowerCase();
  const topicContent = (topic.content  || '').toLowerCase();
  const topicTags    = (topic.tags     || []).map(t => t.toLowerCase());
  const queryWords   = tokenize(queryLower);

  let score = 0;

  queryWords.forEach(word => {
    // Exact topic name match — highest weight
    if (topicName === word)         score += 10;
    else if (topicName.includes(word) && word.length > 3) score += 5;

    // Tag match
    if (topicTags.some(tag => tag.includes(word) && word.length > 2)) score += 4;

    // Content match (first 2000 chars) — lower weight
    if (topicContent.slice(0, 2000).includes(word) && word.length > 3) score += 1;
  });

  // Bonus: phrase match (multi-word sequence in topic name)
  if (queryWords.length >= 2) {
    const phrase = queryWords.join(' ');
    if (topicName.includes(phrase)) score += 8;
  }

  return score;
}

// ── TOKENIZE QUERY ──
function tokenize(text) {
  return text
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

// ── GET ALL TOPICS (for topic picker UI) ──
function getAllTopics() {
  return window.allTopics || [];
}

// ── SEARCH TOPICS (for search UI) ──
function searchTopics(query) {
  if (!query.trim()) return getAllTopics();
  const q = query.toLowerCase();
  return (window.allTopics || []).filter(t =>
    t.topic.toLowerCase().includes(q) ||
    (t.content || '').toLowerCase().slice(0, 500).includes(q)
  );
}

export const RAG = {
  getContext,
  searchTopics,
  getAllTopics,
};

window.RAG = RAG;
