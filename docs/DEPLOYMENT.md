# NewVacancy.live — Deployment Guide

> Hosting and domain are already live. This guide covers extending the running deployment.

---

## 1. Environment Variables to Add in Production

Add these to your hosting platform's environment settings (Vercel, Railway, Render, etc.):

```env
# AI (required)
AI_PROVIDER=auto
OLLAMA_BASE_URL=http://YOUR_OLLAMA_SERVER:11434   # or localhost if co-located
OLLAMA_MODEL=llama3.1
OLLAMA_TIMEOUT=60000

# Telegram (optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHANNEL_ID=@your_channel

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password

# Scraper
SCRAPER_ENABLED=true
SCRAPER_MAX_JOBS_PER_RUN=30   # lower for shared hosting
SCRAPER_RESPECT_ROBOTS=true
SITE_URL=https://www.newvacancy.live
```

---

## 2. Run the Database Migration

In the Supabase SQL Editor, run:

```
backend/supabase/migrations/022_ai_scraper_schema.sql
```

This is **additive-only** — safe to run on production at any time.

---

## 3. Backend Deployment

The backend is a standard Node.js Express server. No build step required.

```bash
# Production start (uses backend/src/server.js)
npm start

# Or with PM2 for process management
pm2 start backend/src/server.js --name newvacancy-api
pm2 save
pm2 startup
```

**All new routes are auto-registered on startup:**
- `GET /api/jobs` — public job listing
- `GET /api/walkins` — walk-in listings
- `GET /api/search` — search endpoint
- `POST /api/assistant/chat` — AI assistant
- `GET /sitemap.xml` — dynamic sitemap
- `GET /robots.txt` — SEO robots
- `GET /api/admin/dashboard-stats` — dashboard
- `POST /api/admin/run-scrapers` — manual trigger

---

## 4. GitHub Actions Setup

In your GitHub repo → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `BACKEND_URL` | `https://api.newvacancy.live` (your backend URL) |
| `BACKEND_SERVICE_TOKEN` | Admin JWT from your login |

Workflows activate automatically:
- `scrape-hourly.yml` — runs every hour at :05
- `expire-daily.yml` — runs at 2:00 AM IST
- `digest-daily-weekly.yml` — monitoring workflow

---

## 5. Ollama Hosting Options

Since Ollama requires local CPU/GPU, you have several options:

| Option | Cost | Latency |
|--------|------|---------|
| Same VPS as backend | Free | Low |
| Separate VPS (DigitalOcean, Hetzner) | ~$6/mo | Low |
| Local machine with ngrok tunnel | Free | Medium |
| `AI_PROVIDER=groq` (skip Ollama) | Free tier | Very low |

### If using Groq only (simplest):
```env
AI_PROVIDER=groq
# OLLAMA_BASE_URL not needed
```

---

## 6. Frontend Deployment

The frontend (React + Vite) is already deployed. No changes required for existing pages.

To add new routes to the frontend, the `App.jsx` update is needed when adding new pages.

---

## 7. Verify Production Deployment

```bash
# Backend health
curl https://api.newvacancy.live/health

# New APIs
curl https://api.newvacancy.live/api/jobs?limit=3
curl https://api.newvacancy.live/api/walkins?period=today
curl https://api.newvacancy.live/api/assistant/health
curl https://www.newvacancy.live/sitemap.xml

# Check Ollama is responding
curl https://api.newvacancy.live/api/admin/ollama-health \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 8. Rollback Plan

All changes are additive. To rollback:

1. **Revert server.js** to previous version (remove new route imports)
2. **DB migration is irreversible** but safe — new columns don't affect existing queries
3. **AI extraction** falls back to Groq automatically if Ollama is down
4. **Scraper** — set `SCRAPER_ENABLED=false` to disable immediately
