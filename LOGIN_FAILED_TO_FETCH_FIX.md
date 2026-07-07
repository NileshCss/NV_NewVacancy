# Fix Login "Failed to Fetch" Error on Different Device

## 🔍 Problem
When trying to login from a phone or different device, you get: **"failed to fetch"** error

---

## 🚀 Solution

### **Step 1: Check Supabase OAuth Configuration** (5 minutes)

1. Go to **Supabase Dashboard** → **Settings** → **Authentication**
2. Click **Providers** → **Google** (or your provider)
3. Look for **"Authorized redirect URIs"**

**You must add ALL these URLs:**
```
https://cmsuomeggkoxkxeqwoam.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
http://localhost:5173/auth/callback
YOUR_DEPLOYED_URL/auth/callback
```

If using **Vercel**, add:
```
https://your-project-name.vercel.app/auth/callback
```

---

### **Step 2: Configure Supabase CORS** (5 minutes)

1. Go to **Supabase Dashboard** → **Settings** → **API** (or **Network**)
2. Look for **"CORS Settings"** or **"Allowed Domains"**
3. Add these domains:
```
localhost:3000
localhost:5173
localhost:*
*.vercel.app
https://cmsuomeggkoxkxeqwoam.supabase.co
```

---

### **Step 3: Are You Running Locally?**

#### **Option A: Running on localhost (Port 5173)?**

❌ **Problem:** Phone can't access `localhost` - that only exists on YOUR computer

✅ **Solution:**
1. Find your computer's IP address:
   - **Windows:** Open PowerShell and run:
   ```powershell
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., `192.168.1.100`)
   
2. Go to that IP on your phone:
   ```
   http://192.168.1.100:5173
   ```

3. Try logging in

#### **Option B: Deployed on Vercel?**

✅ Just use your deployed URL:
```
https://your-project-name.vercel.app
```

---

### **Step 4: Check Browser Console on Phone** (2 minutes)

1. Open the app on your phone
2. Press **F12** (or inspect element)
3. Go to **Console** tab
4. Try to login
5. Look for detailed error message

**Screenshot the error and check:**
- Is it a network error?
- Is it a CORS error?
- Is it "Failed to fetch" from a specific URL?

---

### **Step 5: Update Your Environment** (2 minutes)

If on a different network, create a local `.env` file specifically for local testing:

**frontend/.env:**
```bash
VITE_SUPABASE_URL=https://cmsuomeggkoxkxeqwoam.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtc3VvbWVnZ2tveGt4ZXF3b2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTU4MTcsImV4cCI6MjA5MDA5MTgxN30.tGcOp2wAToFR5z7G0yAovHAveoq_84X6iprZ7R_3cnE
```

Then restart the dev server:
```bash
npm run dev
```

---

## 🔧 Advanced Debugging

### Run this in Supabase Console to test connectivity:

```sql
-- Test 1: Check CORS headers
SELECT 'CORS test' as test,
       'Supabase is accessible' as status;

-- Test 2: Check auth is configured
SELECT 
  'Auth Config' as item,
  'Google OAuth' as provider;

-- Test 3: Verify profiles table is accessible
SELECT COUNT(*) as total_profiles
FROM public.profiles LIMIT 1;
```

---

## 📝 Checklist

- [ ] Logged into Supabase Dashboard
- [ ] Checked OAuth Redirect URIs are configured
- [ ] CORS settings updated with your domain
- [ ] If local testing: Using computer's IP address (e.g., 192.168.x.x:5173)
- [ ] Browser console checked for detailed errors
- [ ] Dev server restarted
- [ ] Browser cache cleared (Ctrl+Shift+Delete)
- [ ] Tried logging in again

---

## 🆘 If Still Not Working

**Send us these details:**

1. **Exact error message** from browser console (F12 → Console tab)
2. **Are you testing on:**
   - [ ] Same WiFi network?
   - [ ] Different WiFi?
   - [ ] Cellular data?
   - [ ] Deployed URL or localhost?
3. **Your setup:**
   - [ ] Running `npm run dev` locally?
   - [ ] Deployed on Vercel?
   - [ ] Other platform?
4. **Device info:**
   - [ ] iPhone/Android/iPad?
   - [ ] Chrome/Safari/Firefox?

---

## 🌐 Quick Reference

| Scenario | URL on Phone | Fix Needed |
|----------|---|---|
| Same WiFi, local dev | `http://192.168.1.100:5173` | Get computer IP + allow CORS |
| Different network | Deploy to Vercel | Deploy + OAuth redirect |
| Using VPN | Same as deployed | Add VPN URL to OAuth |
| Cellular data | Deploy to Vercel | Deploy only |

---

**Last Updated:** May 18, 2026
