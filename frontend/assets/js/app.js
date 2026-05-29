/* ============================================
   EduNaija — app.js
   App initialisation, Firebase setup,
   page routing, global state
   ============================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── FIREBASE CONFIG — replace with yours ──
const firebaseConfig = {
  apiKey: "AIzaSyBpyCXTlfP-c4Jk0mjetDcxmAC0djXy8YU",
    authDomain: "edunaija-3a300.firebaseapp.com",
    projectId: "edunaija-3a300",
    storageBucket: "edunaija-3a300.firebasestorage.app",
    messagingSenderId: "1009640557485",
    appId: "1:1009640557485:web:c7857e6293655c13612f24",
    measurementId: "G-P0ZQNB0E62"
};

// ── WORKER URL — replace after deploying ──
export const WORKER_URL = "edunaija.izymoni33.workers.dev";

// ── INIT ──
const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db   = getFirestore(firebaseApp);

// ── GLOBAL STATE ──
export const State = {
  user:      null,   // Firebase user object
  profile:   null,   // Firestore user profile
  idToken:   null,   // Firebase ID token for Worker requests
  allTopics: [],     // Physics topics from Firestore
  isReady:   false,
};

// ── PAGE ROUTING ──
const PAGES = ['landing', 'chat-ui', 'settings-page'];

export function showPage(id) {
  PAGES.forEach(p => {
    const el = document.getElementById(p);
    if (el) el.classList.toggle('active', p === id);
  });
  if (window.UI) window.UI.closeSidebar();
}
window.showPage = showPage;

// ── GET FRESH ID TOKEN ──
export async function getIdToken() {
  if (!State.user) return null;
  try {
    State.idToken = await State.user.getIdToken(false);
    return State.idToken;
  } catch {
    return null;
  }
}

// ── LOAD USER PROFILE ──
async function loadProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error('loadProfile:', e);
    return null;
  }
}

// ── LOAD PHYSICS TOPICS ──
async function loadTopics() {
  try {
    const q = query(collection(db, 'topics'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    State.allTopics = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.allTopics = State.allTopics;
  } catch (e) {
    console.error('loadTopics:', e);
  }
}

// ── AUTH STATE LISTENER ──
onAuthStateChanged(auth, async (user) => {
  if (user) {
    State.user    = user;
    State.idToken = await user.getIdToken();

    const [profile] = await Promise.all([
      loadProfile(user.uid),
      loadTopics()
    ]);

    State.profile = profile;

    if (window.UI)       window.UI.setUserUI(profile);
    if (window.Settings) window.Settings.load();
    if (window.Sessions) await window.Sessions.loadFromFirestore();

    State.isReady = true;
    showPage('chat-ui');

  } else {
    State.user    = null;
    State.profile = null;
    State.idToken = null;
    State.allTopics = [];
    State.isReady = false;

    if (window.Sessions) window.Sessions.clear();
    if (window.Chat)     window.Chat.reset();
    showPage('landing');
  }
});

// ── REFRESH TOKEN EVERY 50 MIN ──
setInterval(async () => {
  if (State.user) State.idToken = await State.user.getIdToken(true);
}, 50 * 60 * 1000);

window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled rejection:', e.reason);
});
