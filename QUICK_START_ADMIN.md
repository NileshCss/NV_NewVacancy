# 🚀 Quick Start Guide - Admin Dashboard Integration

## ⚡ 5-Minute Setup

### Step 1: Apply Database Migration (2 min)

1. Open [Supabase Dashboard](https://supabase.com)
2. Go to **SQL Editor**
3. Create new query
4. Copy contents of: `backend/supabase/migrations/006_new_news_affiliates_schema.sql`
5. Paste and run ✅

### Step 2: Create Storage Buckets (1 min)

1. Go to **Storage** → **Buckets**
2. Click **New Bucket**
3. Name: `news-images` → Create
4. Click **New Bucket** again
5. Name: `affiliate-images` → Create
6. Make both **PUBLIC** ✅

### Step 3: Set API Keys (1 min)

1. Go to **Project Settings** → **API**
2. Copy `Project URL` and `Anon Key`
3. Update `frontend/.env`:
   ```
   VITE_SUPABASE_URL=your-url-here
   VITE_SUPABASE_ANON_KEY=your-key-here
   ```
4. Save ✅

### Step 4: Start Using! (1 min)

1. Navigate to Admin Panel
2. Click "📰 News" tab
3. Click "+ Add News Article"
4. Fill form and submit ✅

---

## 🎯 Core Features

### News Management
```
Admin → News → Add Article
- Title, content, cover image
- Draft/Published/Archived status
- Search and filter
```

### Affiliate Management
```
Admin → Affiliates → Add Affiliate
- Name, platform, URL
- Logo upload
- Click tracking
```

### AI Assistant
```
Admin → AI Assistant
- Answer mode: Ask questions
- Generate mode: Create content
- Analyze mode: Database insights
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `backend/supabase/migrations/006_*.sql` | Database setup |
| `frontend/src/services/newsAffiliateService.js` | API integration |
| `frontend/src/components/admin/NewsManager.jsx` | News UI |
| `frontend/src/components/admin/AffiliatesManager.jsx` | Affiliates UI |
| `frontend/src/components/admin/AdminAIAssistant.jsx` | AI UI |
| `frontend/src/pages/AdminPanel.jsx` | Main dashboard |

---

## 🔧 Common Issues & Fixes

### Issue: "Failed to save article" (403)

**Fix:** Check user role
```sql
SELECT role FROM profiles WHERE id = 'your-user-id'
-- Should return: admin
```

### Issue: Image upload fails

**Fix:** Verify buckets exist
```
Storage → Buckets
- news-images (PUBLIC) ✓
- affiliate-images (PUBLIC) ✓
```

### Issue: AI Assistant says "key not configured"

**Fix:** Set environment variable
```bash
# Via Supabase CLI:
supabase secret set OPENAI_API_KEY sk-your-key

# Then redeploy function:
supabase functions deploy ai-assistant
```

### Issue: Dashboard shows 0 stats

**Fix:** Verify tables exist
```sql
SELECT COUNT(*) FROM news_v2;     -- Should return 0+ (empty is OK)
SELECT COUNT(*) FROM affiliates_v2; -- Should return 0+ (empty is OK)
```

---

## 📊 What You Can Do Now

✅ **Create unlimited news articles**
✅ **Manage affiliate links with tracking**
✅ **Generate content with AI**
✅ **Search and filter everything**
✅ **Upload images**
✅ **Track clicks on affiliates**
✅ **View dashboard statistics**

---

## 🎓 Learning Path

1. **Day 1:** Create 3-5 news articles using the UI
2. **Day 2:** Add 3-5 affiliate links
3. **Day 3:** Try AI Assistant in all three modes
4. **Day 4:** Test search/filter on all modules
5. **Day 5:** Monitor analytics and optimize

---

## 💡 Pro Tips

- **Slugs auto-generate** from titles. Edit them if needed.
- **Tags are searchable.** Add relevant tags to articles.
- **Photos matter** for engagement. Upload cover images.
- **AI tokens count.** Monitor usage in AI history.
- **Affiliate clicks track automatically** when users click links.

---

## 🔗 Useful Links

- [Supabase Docs](https://supabase.com/docs)
- [React Query Docs](https://tanstack.com/query/latest)
- [Supabase Client JS](https://supabase.com/docs/reference/javascript/introduction)

---

## ❓ Still Have Questions?

Check the full guide: `ADMIN_DASHBOARD_INTEGRATION.md`

---

**Ready to go!** 🎉 Your admin dashboard is now fully functional.
