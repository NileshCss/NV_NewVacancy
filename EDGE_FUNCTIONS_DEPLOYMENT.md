# Supabase Edge Functions Deployment Guide

## Overview
Your application uses Supabase Edge Functions to proxy requests to external APIs (OpenAI). These functions must be deployed to work.

---

## 📦 Available Edge Functions

| Function | Purpose | Dependencies |
|----------|---------|--------------|
| `analyze-resume` | AI-powered resume analysis | `OPENAI_API_KEY` secret |
| `generate-job-recommendations` | Suggest jobs based on profile | Database access |
| `admin-stats` | Admin dashboard analytics | Database access |
| `admin-analytics` | Detailed admin analytics | Database access |
| `save-job` | Save job to user's list | Database access |
| `get-jobs` | Fetch jobs with filters | Database access |
| `get-news` | Fetch news articles | Database access |
| `send-notification-email` | Send email notifications | Email service |
| `affiliate-click` | Track affiliate clicks | Database access |
| `track-affiliate-click` | Advanced affiliate tracking | Database access |

---

## 🚀 Deployment Steps

### Prerequisites
1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

### Deploy All Functions
1. Navigate to project root:
   ```bash
   cd e:\new-vacancy
   ```

2. Link to your Supabase project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   (Get your project ref from Supabase Dashboard URL: `app.supabase.com/project/YOUR_PROJECT_REF`)

3. Deploy all functions:
   ```bash
   supabase functions deploy
   ```

4. Or deploy a specific function:
   ```bash
   supabase functions deploy analyze-resume
   ```

### Verify Deployment
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Edge Functions** in left sidebar
4. You should see all functions listed with status ✅

---

## 🔑 Configure Secrets

Edge Functions need secrets to call external APIs. These are **different** from frontend `.env` variables.

### Set OPENAI_API_KEY Secret (REQUIRED for AI Features)

#### Option A: Via Supabase Dashboard (Easiest)
1. Dashboard → **Edge Functions** → **Secrets**
2. Click **+ New Secret**
3. Fill in:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-proj-...` (your OpenAI API key)
4. Click **Add Secret**
5. Wait 10-30 seconds for it to activate

#### Option B: Via Supabase CLI
```bash
supabase secrets set OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
```

### Verify Secrets Are Set
```bash
supabase secrets list
```

You should see:
```
OPENAI_API_KEY    ***
```

---

## 🧪 Test the Setup

### Test via Dashboard
1. Go to Edge Functions
2. Click on `analyze-resume`
3. Click **Invite** button to test
4. Send a test request with sample messages

### Test via CLI
```bash
supabase functions invoke analyze-resume --body '{"messages": [{"role": "user", "content": "test"}]}'
```

### Test via Frontend App
1. Start dev server: `npm run dev`
2. Navigate to Career AI page
3. Upload a resume
4. If successful, you'll see analysis results
5. If fails, check Error Messages below

---

## 📍 Deployment Locations

### Local Development
Functions run locally when you use:
```bash
supabase start
```

### Production (Hosted on Supabase Cloud)
When you run `supabase functions deploy`, functions are deployed to:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/FUNCTION_NAME
```

The frontend automatically calls them via:
```javascript
supabase.functions.invoke('FUNCTION_NAME', { body: {...} })
```

---

## 🆘 Troubleshooting

### Edge Function Not Found (404)
**Problem**: "Function not found" error in app

**Solution**:
1. Verify function exists:
   ```bash
   supabase functions list
   ```
2. If not listed, deploy it:
   ```bash
   supabase functions deploy analyze-resume
   ```

### OPENAI_API_KEY Not Set
**Problem**: Edge function returns "OPENAI_API_KEY secret not configured"

**Solution**:
1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Create secret named `OPENAI_API_KEY` with your OpenAI key
3. Test after ~30 seconds

### 403 Unauthorized
**Problem**: "Permission Denied" or "Forbidden"

**Solution**:
1. Check your Supabase project ref is correct
2. Verify you're logged in: `supabase projects list`
3. Re-login if needed: `supabase logout && supabase login`

### 500 Internal Server Error
**Problem**: Function returns 500 error

**Solution**:
1. Check Edge Function logs:
   ```bash
   supabase functions logs analyze-resume
   ```
2. Look for error messages
3. Common causes:
   - Invalid OpenAI API key
   - Network timeout
   - Invalid function parameters

### Changes Not Updating
**Problem**: You deployed new code but it's not taking effect

**Solution**:
```bash
# Re-deploy to force update
supabase functions deploy FUNCTION_NAME

# Or deploy all
supabase functions deploy
```

---

## 📚 Useful Commands

```bash
# List all Edge Functions
supabase functions list

# Deploy specific function
supabase functions deploy analyze-resume

# Deploy all functions
supabase functions deploy

# View function logs
supabase functions logs analyze-resume --limit 100

# Set a secret
supabase secrets set OPENAI_API_KEY=your_key

# List all secrets
supabase secrets list

# View function details
supabase functions describe analyze-resume

# Test function locally
supabase functions invoke analyze-resume --body '{"key":"value"}'
```

---

## 📖 References
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/supabase-functions-deploy)
- [Deno Documentation](https://docs.deno.com/) (Edge Functions use Deno)
