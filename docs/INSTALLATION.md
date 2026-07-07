# NewVacancy.live — Installation Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | Bundled with Node |
| Ollama | latest | https://ollama.com |
| Git | any | https://git-scm.com |

---

## 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/new-vacancy.git
cd new-vacancy

# Root dependencies (WhatsApp, etc.)
npm install

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## 2. Ollama Setup (Local AI)

### Install Ollama
```bash
# Linux/macOS
curl -fsSL https://ollama.com/install.sh | sh

# Windows: download installer from https://ollama.com/download/windows
```

### Pull the AI model
```bash
# Recommended (best quality, works on most CPUs)
ollama pull llama3.1

# Alternatives (lighter, faster on low-spec machines)
ollama pull gemma2:2b
ollama pull qwen2.5:3b
ollama pull phi3:mini
ollama pull mistral:7b
```

### Verify Ollama is running
```bash
ollama serve           # Keep this running in background
curl http://localhost:11434/api/tags  # Should return model list
```

---

## 3. Environment Variables

Copy and fill in all required values:

```bash
cp backend/.env backend/.env.local
```

Edit `backend/.env`:

```env
# Required — already set if existing project
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
GROQ_API_KEY=...           # Fallback if Ollama is down

# AI Provider (auto = try Ollama first, fall back to Groq)
AI_PROVIDER=auto
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1

# Telegram (optional)
TELEGRAM_BOT_TOKEN=         # From @BotFather
TELEGRAM_CHANNEL_ID=        # @channel or -100xxx

# Email (optional)
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password  # Gmail App Password

# Scraper
SCRAPER_ENABLED=true
SITE_URL=https://www.newvacancy.live
```

---

## 4. Run the Database Migration

Open the Supabase SQL Editor and run **in order**:

```
1. backend/supabase/migrations/022_ai_scraper_schema.sql
```

> **Important:** This is additive — it only adds new columns and tables.
> Existing data is never modified.

Verify migration:
```sql
-- Should show new columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'jobs' AND column_name IN ('slug', 'status', 'skills', 'is_walkin');

-- Should return rows
SELECT name FROM public.cities LIMIT 5;
SELECT name FROM public.categories LIMIT 5;
```

---

## 5. Start Development Servers

```bash
# Terminal 1: Backend API
npm run dev             # starts at http://localhost:5000

# Terminal 2: Frontend
cd frontend
npm run dev             # starts at http://localhost:5173

# Terminal 3: Ollama (keep running)
ollama serve
```

---

## 6. Verify the Installation

```bash
# Backend health
curl http://localhost:5000/health

# Ollama health (via backend)
curl http://localhost:5000/api/assistant/health

# Public jobs API
curl http://localhost:5000/api/jobs?limit=5

# Walk-ins API
curl http://localhost:5000/api/walkins?period=week

# AI extraction test (requires admin auth)
curl -X POST http://localhost:5000/api/admin/scrape-job \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.infosys.com/careers/job-description.html"}'
```

---

## 7. Telegram Bot Setup (Optional)

1. Message `@BotFather` on Telegram
2. Send `/newbot`, follow instructions, get `TELEGRAM_BOT_TOKEN`
3. Create a channel, add your bot as admin
4. Get the channel ID: forward a message to `@userinfobot`
5. Set `TELEGRAM_CHANNEL_ID` in `.env`

---

## 8. Gmail App Password (Email Digest)

1. Enable 2FA on your Google account
2. Go to: https://myaccount.google.com/apppasswords
3. Create App Password for "Mail"
4. Set `SMTP_USER` and `SMTP_PASS` in `.env`

---

## 9. GitHub Actions Secrets

If using GitHub Actions for automation, set these secrets in your repo settings:

| Secret | Value |
|--------|-------|
| `BACKEND_URL` | Your backend URL (e.g. `https://api.newvacancy.live`) |
| `BACKEND_SERVICE_TOKEN` | Admin JWT token for API auth |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Ollama unreachable` | Run `ollama serve` — it must be running |
| `Model not found` | Run `ollama pull llama3.1` |
| `Groq fallback active` | Normal — Groq is used when Ollama is down |
| `robots.txt disallowed` | Set `SCRAPER_RESPECT_ROBOTS=false` for testing only |
| `Duplicate detected` | Pass `force_insert: true` in scrape-and-save body |
| Migration fails | Check for existing column: use `ADD COLUMN IF NOT EXISTS` |
