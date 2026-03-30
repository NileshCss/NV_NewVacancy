# Edge Function Setup Guide

## Issue
The AI Resume Analysis feature fails with: **"AI proxy error: Failed to send a request to the Edge Function"**

This happens when the `OPENAI_API_KEY` secret is not configured in your Supabase project.

---

## ✅ Solution: Configure Edge Function Secrets

### Step 1: Get Your OpenAI API Key
1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new API key (or use an existing one)
3. Copy the key to your clipboard

### Step 2: Set Secret in Supabase Dashboard
1. Log into [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your **new-vacancy** project
3. Go to **Edge Functions** → **Secrets**
4. Create a new secret:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-...` (your OpenAI API key)
5. Click **Add Secret**

### Step 3: Verify Edge Function is Deployed
1. In Supabase Dashboard, go to **Edge Functions**
2. You should see these deployed functions:
   - ✅ `analyze-resume` (required for AI Resume Analysis)
   - ✅ `generate-job-recommendations`
   - ✅ `admin-stats`
   - ✅ Others...

**If `analyze-resume` is NOT listed**, deploy it using Supabase CLI:
```bash
supabase functions deploy analyze-resume
```

### Step 4: Test the Connection
Once secrets are set, try uploading a resume in the app again. The error should disappear.

---

## 🔧 Environment Variables Checklist

### Frontend (.env file)
Your frontend needs this `.env` file (create it from `.env.example`):
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_OPENAI_API_KEY=your-openai-api-key-here
VITE_APP_NAME=New_vacancy
VITE_APP_URL=https://your-domain.vercel.app
```

### Supabase Edge Function Secrets
Set in **Supabase Dashboard → Edge Functions → Secrets**:
- `OPENAI_API_KEY` - Your OpenAI API key for the `analyze-resume` function
- (Supabase automatically provides: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)

---

## 📋 Deployment Checklist

- [ ] Created `.env` file in frontend folder
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
- [ ] Set `VITE_OPENAI_API_KEY` in frontend `.env`
- [ ] Opened Supabase Dashboard
- [ ] Navigated to Edge Functions → Secrets
- [ ] Created `OPENAI_API_KEY` secret with your OpenAI key
- [ ] Verified `analyze-resume` Edge Function exists
- [ ] (Optional) Ran `supabase functions deploy analyze-resume` to redeploy
- [ ] Tested resume upload feature in the app

---

## 🆘 Troubleshooting

### Still getting "Failed to send a request" error?
1. **Clear browser cache**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. **Check Supabase status**: Is `analyze-resume` function deployed?
3. **Verify OpenAI API key**: Is it valid and has usage quota?
4. **Check Supabase logs**: 
   - Dashboard → Edge Functions → `analyze-resume` → Logs
   - Look for error messages

### "OPENAI_API_KEY secret not configured"?
- Go back to Step 2 above
- Make sure you used EXACT name: `OPENAI_API_KEY`
- Click the **Add Secret** button to save

### Edge Function returns 500 error?
- Check that OpenAI API key has:
  - ✅ Valid permissions 
  - ✅ Not expired
  - ✅ Has available quota ($)
  - ✅ Is active (not revoked)

---

## 📚 References
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Secrets Management](https://supabase.com/docs/guides/functions/secrets)
- [OpenAI API Keys](https://platform.openai.com/api-keys)
