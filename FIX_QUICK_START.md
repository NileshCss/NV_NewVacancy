# 🎯 Quick Fix Checklist - AI Resume Analysis Error

**Error**: ❌ "AI proxy error: Failed to send a request to the Edge Function"  
**Status**: 🔧 FIXABLE in 10 minutes  
**Difficulty**: ⭐ Easy

---

## ⚡ What You Need to Do RIGHT NOW

### Step 1: Get OpenAI API Key (2 min)
- [ ] Go to: https://platform.openai.com/api-keys
- [ ] Click **"Create new secret key"**
- [ ] Copy the key (starts with `sk-proj-`)
- [ ] Keep it safe - you'll need it in next steps

### Step 2: Add Secret to Supabase (3 min)
- [ ] Open: https://supabase.com/dashboard
- [ ] Select **new-vacancy** project
- [ ] Click **Edge Functions** (left menu)
- [ ] Click **Secrets** tab
- [ ] Click **+ New Secret** button
- [ ] **Name**: `OPENAI_API_KEY` (EXACT spelling!)
- [ ] **Value**: Paste your OpenAI key from Step 1
- [ ] Click **Add Secret** button
- [ ] Wait 30 seconds for changes to apply

### Step 3: Test It (2 min)
- [ ] Go to your app
- [ ] Click "Analyze Resume & Match Jobs" button
- [ ] Upload any PDF or DOCX file
- [ ] ✅ Should work! (No more error)

---

## 📋 If That Doesn't Work...

### Check List

- [ ] **Is the secret actually saved?**
  - Go back to Supabase Dashboard → Edge Functions → Secrets
  - Should see `OPENAI_API_KEY` listed

- [ ] **Did you hard refresh the app?**
  - `Ctrl + Shift + R` (Windows/Linux)
  - `Cmd + Shift + R` (Mac)

- [ ] **Is the Edge Function deployed?**
  - Dashboard → Edge Functions
  - Should see `analyze-resume` listed ✅

- [ ] **Does your OpenAI key work?**
  - Visit: https://platform.openai.com/account/usage/overview
  - Check you have API usage quota ($ remaining)
  - Key should not be "revoked"

### Still Having Issues?

1. **Read**: `FIX_AI_RESUME_ERROR.md` (in project root)
   - Has detailed troubleshooting with visual diagrams

2. **Read**: `EDGE_FUNCTIONS_DEPLOYMENT.md` (in project root)
   - Complete deployment guide if function isn't deployed

3. **Check logs**: 
   - Supabase Dashboard → Edge Functions → `analyze-resume` → Logs
   - Look for error messages

---

## 🔄 How This Works

```
[Your Browser]
     ↓ (Upload resume)
[Frontend React App]
     ↓ Calls supabase.functions.invoke()
[Supabase Edge Function: analyze-resume]
     ↓ Uses OPENAI_API_KEY secret
[OpenAI API (gpt-4o-mini model)]
     ↓ Returns analysis
[Your Browser Shows Results]
     ✅ Done!
```

**The error happens at** → [Supabase Edge Function] because it can't find the `OPENAI_API_KEY` secret.

---

## 📝 Summary of Changes Made

✅ **Enhanced error messages** in frontend
- Now shows helpful diagnostics (what's wrong & how to fix it)
- Better error messages for different failure types

✅ **Created documentation**:
- `FIX_AI_RESUME_ERROR.md` - Quick fix guide
- `EDGE_FUNCTION_SETUP.md` - Full setup details
- `EDGE_FUNCTIONS_DEPLOYMENT.md` - Deployment guide
- `frontend/.env.template.md` - Environment setup guide

---

## 🎓 What Went Wrong (Explained Simply)

The app has an **AI Resume Analysis** feature that:
1. Takes your resume (PDF, DOCX, TXT)
2. Sends it to an Edge Function on Supabase
3. Edge Function calls OpenAI's AI
4. Returns analysis results

**Problem**: The Edge Function couldn't call OpenAI because it doesn't know your OpenAI API key.

**Solution**: Store your OpenAI key as a "secret" in Supabase so the Edge Function can use it.

---

## ✨ Once Fixed

After following the steps above, your users can:
- ✅ Upload resume (PDF/DOCX/TXT, up to 5MB)
- ✅ Get ATS score
- ✅ See job matches
- ✅ Get career improvement suggestions
- ✅ Get India market insights

---

**Questions?** Check any of the `.md` files mentioned above, or see the Supabase/OpenAI documentation linked in them.
