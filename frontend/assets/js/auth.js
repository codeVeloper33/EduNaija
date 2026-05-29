/* ============================================
   EduNaija — auth.js
   Firebase login, signup, logout,
   profile creation, password toggle
   ============================================ */

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const auth = getAuth();
const db   = getFirestore();

// ── SIGN UP ──
export async function signUp(name, email, password, studentClass) {
  const btn = document.getElementById('signupBtn');
  const err = document.getElementById('signupErr');
  setAuthLoading(btn, true, 'Creating account...');
  hideError(err);

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });

    // Create Firestore profile
    await setDoc(doc(db, 'users', cred.user.uid), {
      name,
      email,
      class: studentClass || 'SS3',
      plan: 'free',
      questionsToday: 0,
      totalQuestions: 0,
      createdAt: serverTimestamp(),
      settings: {
        theme: 'dark',
        font:  'default',
        speechLang: 'en-NG',
        haptic: true,
        notifications: true
      }
    });

    window.UI?.showToast('Account created! Welcome to EduNaija 🎓');
  } catch (e) {
    showError(err, getFriendlyError(e.code));
  } finally {
    setAuthLoading(btn, false, 'Create Account');
  }
}

// ── SIGN IN ──
export async function signIn(email, password) {
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginErr');
  setAuthLoading(btn, true, 'Signing in...');
  hideError(err);

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.UI?.showToast('Welcome back! 👋');
  } catch (e) {
    showError(err, getFriendlyError(e.code));
  } finally {
    setAuthLoading(btn, false, 'Sign In');
  }
}

// ── SIGN OUT ──
export async function doLogout() {
  try {
    await signOut(auth);
    window.UI?.showToast('Signed out. See you soon! 👋');
    document.getElementById('profile-dropdown')?.classList.remove('show');
  } catch (e) {
    console.error('Logout error:', e);
  }
}
window.doLogout = doLogout;

// ── FORGOT PASSWORD ──
export async function forgotPassword(email) {
  if (!email) {
    window.UI?.showToast('Enter your email first');
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    window.UI?.showToast('Password reset email sent! Check your inbox 📧');
  } catch (e) {
    window.UI?.showToast(getFriendlyError(e.code));
  }
}
window.forgotPassword = forgotPassword;

// ── FORM HANDLERS ──
window.handleSignup = function(e) {
  e?.preventDefault();
  const name     = document.getElementById('signup-name')?.value.trim();
  const email    = document.getElementById('signup-email')?.value.trim();
  const password = document.getElementById('signup-password')?.value;
  const cls      = document.getElementById('signup-class')?.value;

  if (!name || !email || !password) {
    const err = document.getElementById('signupErr');
    showError(err, 'Please fill in all fields');
    return;
  }
  if (password.length < 6) {
    const err = document.getElementById('signupErr');
    showError(err, 'Password must be at least 6 characters');
    return;
  }
  signUp(name, email, password, cls);
};

window.handleLogin = function(e) {
  e?.preventDefault();
  const email    = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  if (!email || !password) {
    const err = document.getElementById('loginErr');
    showError(err, 'Please enter your email and password');
    return;
  }
  signIn(email, password);
};

// ── PASSWORD VISIBILITY TOGGLE ──
window.togglePassword = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  if (btn) btn.textContent = isText ? '👁️' : '🙈';
};

// ── SWITCH BETWEEN LOGIN / SIGNUP ──
window.showLogin = function() {
  document.getElementById('loginModal')?.classList.add('show');
  document.getElementById('signupModal')?.classList.remove('show');
};
window.showSignup = function() {
  document.getElementById('signupModal')?.classList.add('show');
  document.getElementById('loginModal')?.classList.remove('show');
};
window.closeLogin  = function() { document.getElementById('loginModal')?.classList.remove('show'); };
window.closeSignup = function() { document.getElementById('signupModal')?.classList.remove('show'); };

// Close modals on backdrop click
document.addEventListener('click', e => {
  ['loginModal', 'signupModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el && e.target === el) el.classList.remove('show');
  });
});

// ── HELPERS ──
function setAuthLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = label;
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function hideError(el) {
  if (!el) return;
  el.textContent = '';
  el.classList.remove('show');
}

function getFriendlyError(code) {
  const map = {
    'auth/user-not-found':       'No account found with this email',
    'auth/wrong-password':       'Incorrect password',
    'auth/email-already-in-use': 'This email is already registered',
    'auth/invalid-email':        'Please enter a valid email address',
    'auth/weak-password':        'Password must be at least 6 characters',
    'auth/invalid-credential':   'Incorrect email or password',
    'auth/too-many-requests':    'Too many attempts. Please try again later',
    'auth/network-request-failed': 'Network error. Check your connection',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
