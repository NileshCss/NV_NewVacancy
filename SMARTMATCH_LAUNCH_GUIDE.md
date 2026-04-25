# 🧠 SmartMatch™ Engine — Launch & Deployment Guide

## Phase 1: Database Setup

### Step 1 — Execute SQL Migration in Supabase

1. Go to **Supabase Console** → Your Project → **SQL Editor**
2. Create a new query
3. Copy the SQL from `backend/supabase/migrations/013_smartmatch_resume_analyses.sql`
4. Paste it into the SQL Editor
5. Click **Run** button (or press `Ctrl+Enter`)

**Expected Output:**
```
Query successful (0 rows affected)
```

This creates:
- ✅ `resume_analyses` table with UUID PK, user_id FK, JSONB results storage
- ✅ 4 performance indexes (user_id, file_hash, created_at DESC, ats_score DESC)
- ✅ Row-Level Security (RLS) policy for user data isolation
- ✅ Permissions granted to authenticated users

---

## Phase 2: Environment Configuration

### Backend (.env) — Already Configured ✅

**File:** `backend/.env`

Contains:
- ✅ PORT=5000 (backend server port)
- ✅ ANTHROPIC_API_KEY (requires your own from console.anthropic.com)
- ✅ SUPABASE_URL & SERVICE_KEY (auto-filled from frontend project)
- ✅ REDIS_URL (localhost:6379 for local dev, or Redis Cloud URL for prod)
- ✅ FRONTEND_URL=http://localhost:5173
- ✅ RATE_LIMIT_ANALYSES_PER_HOUR=10

**Action Required:** Replace `ANTHROPIC_API_KEY` with your actual key from:
1. https://console.anthropic.com
2. Create API key
3. Copy and paste into `backend/.env` under ANTHROPIC_API_KEY

### Frontend (.env) — Already Configured ✅

**File:** `frontend/.env`

Contains:
- ✅ VITE_API_URL=http://localhost:5000/api (backend API endpoint)
- ✅ VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY (auto-filled)

---

## Phase 3: Launch Servers

### Terminal 1 — Start Backend Server

```bash
cd e:\new-vacancy\backend
node src/server.js
```

**Expected Output:**
```
[Morgan] [:date[iso]] :method :url :status :response-time ms
[Server] SmartMatch™ Engine running on port 5000
[Server] Environment: production
[Server] CORS: Enabled for http://localhost:5173
```

**✅ Backend is ready when you see:** `SmartMatch™ Engine running on port 5000`

---

### Terminal 2 — Start Frontend Dev Server

```bash
cd e:\new-vacancy\frontend
npm run dev
```

**Expected Output:**
```
  VITE v5.x.x
  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

**✅ Frontend is ready when you see:** `http://localhost:5173/` URL

---

## Phase 4: Access & Test SmartMatch™

### Step 1 — Open Application

1. Open browser → **http://localhost:5173**
2. You should see NewVacancy.live homepage
3. Look for navbar with links: Govt Jobs, Private Jobs, News, 🎁 Offers, **🧠 SmartMatch**

### Step 2 — Click SmartMatch Link

1. Click **"🧠 SmartMatch"** in navbar (shows FREE badge)
2. You should see:
   - Hero title: "AI Resume Analyzer"
   - 3 feature cards (ATS Score, Job Match, Skill Gaps)
   - Upload dropzone with "Drop resume here or click"

### Step 3 — Upload & Analyze Resume

1. **Click the dropzone** or **drag-drop a resume file** (PDF, DOCX, DOC, or TXT)
   - Supported: PDF, DOCX, DOC, TXT
   - Max size: 5MB
2. **(Optional)** Open `<details>` section and paste a job description
3. **Select analysis mode** (4 buttons):
   - 🧠 Full Analysis (default, 4000 tokens)
   - 📊 ATS Only (fast, 2000 tokens)
   - 🛠 Skill Gap (roadmap focus, 2000 tokens)
   - ✍️ Rewrite (bullet improvement, 2000 tokens)
4. Click **"🚀 Analyze My Resume"** button

### Step 4 — Watch Progress Animation

- Circular progress ring animates 0→100%
- Shows step labels: "Extracting text" → "Parsing structure" → ... → "Rewriting bullets"
- Progress indicator chips light up as analysis progresses

### Step 5 — View 6-Tab Results Dashboard

Once analysis completes (typically 15-30 seconds), you'll see:

#### Tab 1: 📊 **Summary**
- 4 stat cards: ATS Score, Job Match %, Skills Found, Skill Gaps
- 💰 Salary Projection (Current / After Rewrite / 3 Months / 6 Months)
- ⚡ Quick Wins (top 5 actionable improvements with score boost)

#### Tab 2: 🎯 **ATS Score**
- Large ATS grade (A+, A, B+, B, C, D)
- 5 breakdown bars (Skills 40%, Experience 25%, Education 15%, Completeness 10%, Keywords 10%)
- High-value missing keywords display

#### Tab 3: 💼 **Matches** (if job description provided)
- Match % score with verdict
- 4 breakdown bars (Skills 50%, Experience 20%, Education 20%, Keywords 10%)
- Required skills you have ✅
- Required skills you need ✗

#### Tab 4: 🛠 **Skill Gap**
- ✅ Your Strengths (all detected skills)
- ⚠️ Critical Missing (skills with penalties)
- 📈 Learning Roadmap (phases: Now/Urgent, Months 1-2, Months 3-6 with salary progression)

#### Tab 5: 💡 **Improve**
- ✅ List of resume strengths identified
- Weakness cards (color-coded: 🔴 Critical, 🟡 High, 🔵 Medium)
- Each card shows: before text, improved text, description

#### Tab 6: ✍️ **Rewrite**
- 📝 Rewritten professional summary (with copy button)
- ✍️ Improved experience bullets per role (with copy buttons)
- Use these rewrites directly in your resume

### Step 6 — Copy & Use Results

- **Click 📋 icon** next to any text to copy to clipboard
- **"Alert"** notification confirms copy success
- Paste directly into your resume

---

## Phase 5: Testing Checklist

- [ ] Backend server starts without errors on port 5000
- [ ] Frontend dev server starts on http://localhost:5173
- [ ] Can navigate to SmartMatch page from navbar
- [ ] File upload accepts PDF, DOCX, DOC, TXT
- [ ] Analysis mode selector shows 4 options
- [ ] Progress animation runs 0-100% smoothly
- [ ] Results dashboard displays all 6 tabs
- [ ] ATS Score tab shows breakdown bars
- [ ] Job Match tab appears if job description provided
- [ ] Skill Gap tab shows learning roadmap
- [ ] Copy-to-clipboard works (📋 buttons)
- [ ] "↺ Analyze Another" button resets to upload screen
- [ ] Rate limiting enforced (10 analyses/hour if authenticated)
- [ ] Results cached (repeat same file returns instantly)
- [ ] Error handling shows user-friendly messages for failures

---

## Phase 6: Troubleshooting

### Issue: Backend fails to start
**Solution:**
- Verify `ANTHROPIC_API_KEY` is set in `backend/.env`
- Check Redis is running: `redis-cli ping` should return PONG
- Kill any process on port 5000: `netstat -ano | findstr :5000` then `taskkill /PID <PID> /F`

### Issue: Frontend can't connect to backend
**Solution:**
- Verify `VITE_API_URL=http://localhost:5000/api` in `frontend/.env`
- Check backend server is running and listening on 5000
- Clear browser cache: `Ctrl+Shift+Delete`

### Issue: File upload fails
**Solution:**
- Ensure file size < 5MB
- Supported formats: PDF, DOCX, DOC, TXT only
- Try with a different file format

### Issue: Analysis times out
**Solution:**
- Ensure ANTHROPIC_API_KEY is valid and has quota
- Check Claude API console for any rate limits
- Retry after a few seconds

### Issue: Results not saving to database
**Solution:**
- Verify SQL migration executed successfully in Supabase
- Check RLS policies: `ALTER TABLE resume_analyses ENABLE ROW LEVEL SECURITY`
- Confirm user is authenticated before analysis
- Check browser console for auth errors

---

## Phase 7: Production Deployment

To deploy to production:

1. **Backend → Vercel / Railway / Render:**
   - Push code to GitHub
   - Set environment variables (ANTHROPIC_API_KEY, SUPABASE_SERVICE_KEY, etc.)
   - Deploy with `npm run build` or `node src/server.js`
   - Update FRONTEND_URL in backend .env

2. **Frontend → Vercel:**
   - Set VITE_API_URL to production backend URL
   - Deploy with `npm run build`
   - Frontend will be at production domain

3. **Database:**
   - Supabase handles scaling automatically
   - Monitor resume_analyses table size
   - Archive old analyses after 90 days if needed

---

## 🎉 Success Indicators

✅ When you see this, SmartMatch™ is fully functional:

1. Backend console shows: `[Server] SmartMatch™ Engine running on port 5000`
2. Frontend URL shows: http://localhost:5173
3. Navbar has 🧠 SmartMatch with FREE badge
4. Can upload resume and trigger analysis
5. Progress animation runs smoothly 0-100%
6. Results display in all 6 tabs
7. Copy buttons work for bullets
8. No console errors in browser DevTools

---

**Build Time:** ~30 minutes setup
**First Analysis:** ~20-40 seconds (cached results return instantly)
**Support:** Check error logs in terminal for debugging
