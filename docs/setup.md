# EduNaija — Deployment Guide

## Prerequisites
- Node.js installed
- Git installed
- Firebase account
- Cloudflare account (free)

---

## Step 1 — Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/edunaija.git
cd edunaija
npm install -g wrangler firebase-tools
```

---

## Step 2 — Firebase Setup

1. Go to https://console.firebase.google.com
2. Create a new project called **edunaija**
3. Enable **Firestore Database** (production mode)
4. Enable **Authentication** → Email/Password
5. Go to Project Settings → Your apps → Add Web App
6. Copy the config object into `frontend/assets/js/app.js`

### Deploy Firestore rules & indexes:
```bash
firebase login
firebase use --add   # select your project
firebase deploy --only firestore
```

---

## Step 3 — Cloudflare Worker Setup

### Install & login:
```bash
wrangler login
```

### Create KV namespace:
```bash
wrangler kv:namespace create RATE_LIMIT_KV
```
Copy the returned `id` into `worker/wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "PASTE_ID_HERE"
```

### Set secrets:
```bash
wrangler secret put GEMINI_KEY
wrangler secret put GROQ_KEY
wrangler secret put FIREBASE_PROJECT_ID
```

### Deploy worker:
```bash
cd worker
wrangler deploy
```
Copy the Worker URL (e.g. `https://edunaija-worker.USERNAME.workers.dev`)
Paste it into `frontend/assets/js/app.js` as `WORKER_URL`

---

## Step 4 — Deploy Frontend

### Option A — Firebase Hosting (recommended):
```bash
firebase deploy --only hosting
```
Your app is live at: `https://YOUR_PROJECT.web.app`

### Option B — GitHub Pages:
1. Push the `frontend/` folder to a GitHub repo
2. Go to repo Settings → Pages → Deploy from branch `main` / `frontend` folder
3. Your app is live at: `https://USERNAME.github.io/edunaija`

---

## Step 5 — Add Physics Topics to Firestore

Each topic document in the `topics` collection should have:
```json
{
  "order":    1,
  "topic":    "Ohm's Law",
  "category": "Electricity",
  "tags":     ["resistance", "voltage", "current"],
  "content":  "Full textbook content here..."
}
```

You can bulk-upload using the Firebase Admin SDK or the Firestore Console.

---

## Done! 🎉

Your app is live with:
- ✅ Secure backend (API keys hidden)
- ✅ Firebase Auth
- ✅ Firestore chat persistence
- ✅ Rate limiting (10 questions/day free)
- ✅ Gemini + Groq fallback
- ✅ Dark/Light/System mode
- ✅ Voice input, image upload
