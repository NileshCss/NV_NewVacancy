# 🔴 AI Resume Analysis Not Working? Here's the Fix

## The Problem
```
Error: "AI proxy error: Failed to send a request to the Edge Function"
```

This error means **your Supabase Edge Function cannot reach OpenAI** because the API key is missing.

---

## ⚡ Quick Fix (5 minutes)

### 1️⃣ Get OpenAI API Key
- Visit: https://platform.openai.com/api-keys
- Click **"Create new secret key"**
- Copy the key (looks like: `sk-proj-...`)

### 2️⃣ Open Supabase Dashboard
- Go to: https://supabase.com/dashboard
- Select your **new-vacancy** project

### 3️⃣ Add API Key as Secret
- Click **Edge Functions** in left menu
- Click **Secrets** tab
- Click **+ New Secret**
- Fill in:
  - **Name**: `OPENAI_API_KEY`
  - **Value**: `sk-proj-...` (your OpenAI key from Step 1)
- Click **Add Secret**

### 4️⃣ Test It
- Go back to your app
- Try uploading a resume again
- ✅ Should work now!

---

## 📋 What Needs to Happen

```
┌─────────────────┐
│  Your Browser   │
│  (React App)    │
└────────┬────────┘
         │
         │ Upload resume
         │
         ▼
┌─────────────────────────────┐
│   Supabase Edge Function    │◄─── Missing: OPENAI_API_KEY
│   (analyze-resume)          │
└────────┬────────────────────┘
         │
         │ Proxy request
         │
         ▼
    ❌ FAILS → Shows error message
```

**Once you add the secret:**
```
┌─────────────────┐
│  Your Browser   │
│  (React App)    │
└────────┬────────┘
         │
         │ Upload resume
         │
         ▼
┌─────────────────────────────┐
│   Supabase Edge Function    │◄─── ✅ Has: OPENAI_API_KEY
│   (analyze-resume)          │
└────────┬────────────────────┘
         │
         │ Proxy request with API key
         │
         ▼
┌─────────────────────────────┐
│   OpenAI API                │
│   (gpt-4o-mini)             │
└────────┬────────────────────┘
         │
         │ Returns AI analysis
         │
         ▼
┌─────────────────┐
│  Your Browser   │
│  Shows Results! │ ✅
└─────────────────┘
```

---

## ✅ Verification Checklist

- [ ] Have an OpenAI account with API access
- [ ] Generated an API key from platform.openai.com/api-keys
- [ ] Logged into Supabase Dashboard
- [ ] Navigated to Edge Functions → Secrets
- [ ] Created a secret named **exactly** `OPENAI_API_KEY`
- [ ] Pasted the `sk-proj-...` key
- [ ] Clicked **Add Secret** button
- [ ] Waited ~10 seconds for secret to be active
- [ ] Went back to the app and tried the feature again

---

## 🆘 Still Not Working?

### Check 1: Is the secret saved?
- Dashboard → Edge Functions → Secrets
- Should see `OPENAI_API_KEY` listed

### Check 2: Is the Edge Function deployed?
- Dashboard → Edge Functions
- Should see `analyze-resume` listed ✅
- If not: Run `supabase functions deploy analyze-resume`

### Check 3: Hard refresh your browser
- `Ctrl + Shift + R` (Windows)
- `Cmd + Shift + R` (Mac)
- Clears any cached errors

### Check 4: Check OpenAI account
- Visit: https://platform.openai.com/account/usage/overview
- Do you have usage quota remaining?
- Is your API key valid and not revoked?

---

## 📞 Need Help?

1. Check the **EDGE_FUNCTION_SETUP.md** file for more details
2. See [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
3. See [OpenAI API Docs](https://platform.openai.com/docs)
