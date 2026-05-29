/* ============================================
   EduNaija — voice.js
   Speech-to-text using Web Speech API
   Microphone input → fills chat textarea
   ============================================ */

// ── BROWSER SUPPORT ──
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const isSupported = !!SpeechRecognition;

// ── STATE ──
let recognition  = null;
let isRecording  = false;
let _lang        = 'en-NG';
let _interimText = '';

// ── INIT ──
function init() {
  if (!isSupported) return;

  recognition = new SpeechRecognition();
  recognition.continuous      = true;
  recognition.interimResults  = true;
  recognition.lang            = _lang;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecording = true;
    _updateBtn(true);
    window.UI?.showToast('🎤 Listening…');
  };

  recognition.onresult = e => {
    let interim   = '';
    let finalText = '';

    for (let i = e.resultIndex; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += transcript + ' ';
      else interim += transcript;
    }

    const input = document.getElementById('chat-input');
    if (!input) return;

    _interimText = interim;
    // Append final text to any existing typed text
    if (finalText) {
      input.value = (input.value + finalText).trim();
      _interimText = '';
    }

    // Show interim as placeholder-style grey text
    input.placeholder = interim || 'Ask EduNaija anything about Physics…';
    window.autoResize?.(input);
  };

  recognition.onerror = e => {
    console.error('Speech recognition error:', e.error);
    const messages = {
      'no-speech':          'No speech detected. Try again.',
      'audio-capture':      'Microphone not found.',
      'not-allowed':        'Microphone permission denied.',
      'network':            'Network error during recognition.',
      'aborted':            null, // intentional stop
    };
    const msg = messages[e.error];
    if (msg) window.UI?.showToast(`🎤 ${msg}`);
    stopRecording();
  };

  recognition.onend = () => {
    isRecording = false;
    _updateBtn(false);
    // Restore placeholder
    const input = document.getElementById('chat-input');
    if (input) input.placeholder = 'Ask EduNaija anything about Physics…';
  };
}

// ── TOGGLE ──
function toggle() {
  if (!isSupported) {
    window.UI?.showToast('Voice input not supported in this browser');
    return;
  }
  if (isRecording) stopRecording();
  else startRecording();
}

function startRecording() {
  if (!recognition) init();
  if (!recognition) return;
  try {
    recognition.lang = _lang;
    recognition.start();
  } catch (e) {
    console.error('start recognition error:', e);
  }
}

function stopRecording() {
  if (recognition && isRecording) {
    recognition.stop();
  }
  isRecording = false;
  _updateBtn(false);
}

// ── UPDATE BUTTON STATE ──
function _updateBtn(recording) {
  const btn = document.getElementById('voiceBtn');
  if (!btn) return;
  btn.classList.toggle('recording', recording);
  btn.title = recording ? 'Stop recording' : 'Voice input';
  btn.innerHTML = recording ? '⏹️' : '🎤';
}

// ── SET LANGUAGE ──
function setLang(lang) {
  _lang = lang;
  if (recognition) recognition.lang = lang;
}

export const Voice = {
  toggle,
  startRecording,
  stopRecording,
  setLang,
  isSupported: () => isSupported,
  isRecording: () => isRecording,
};

window.Voice       = Voice;
window.toggleVoice = toggle;

// Init on load
if (isSupported) init();
