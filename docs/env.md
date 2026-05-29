# EduNaija — Environment Variables

## Cloudflare Worker Secrets
Set these with: `wrangler secret put SECRET_NAME`

| Secret                  | Where to get it                                      |
|-------------------------|------------------------------------------------------|
| `GEMINI_KEY`            | https://aistudio.google.com/app/apikey               |
| `GROQ_KEY`              | https://console.groq.com/keys                        |
| `FIREBASE_PROJECT_ID`   | Firebase Console → Project Settings → General        |

## Cloudflare Worker Vars (wrangler.toml)
| Variable           | Value                              |
|--------------------|------------------------------------|
| `ALLOWED_ORIGIN`   | Your frontend URL e.g. https://edunaija.web.app |

## Cloudflare KV Namespace
| Binding            | Purpose                            |
|--------------------|------------------------------------|
| `RATE_LIMIT_KV`    | Stores per-user daily question counts |

Create with: `wrangler kv:namespace create RATE_LIMIT_KV`
Then paste the returned ID into wrangler.toml.

## Frontend (assets/js/app.js)
| Variable           | Where to get it                    |
|--------------------|------------------------------------|
| `firebaseConfig`   | Firebase Console → Project Settings → Your apps |
| `WORKER_URL`       | Shown after `wrangler deploy`      |
