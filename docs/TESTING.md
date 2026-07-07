# NewVacancy.live — Testing Guide

## Backend Unit Tests

### 1. Ollama Health Check
```bash
node -e "
const { checkHealth } = require('./backend/src/ai/ollamaClient');
checkHealth().then(h => console.log('Ollama Health:', JSON.stringify(h, null, 2)));
"
```

### 2. AI Extraction Pipeline Test
```bash
node -e "
require('dotenv').config({ path: './backend/.env' });
const { extractJobData } = require('./backend/src/ai/extractJob.service');
const text = 'Java Developer at Infosys, Bangalore. Salary: 4-6 LPA. Freshers eligible. B.Tech/MCA required. Apply by Dec 31. Skills: Java, Spring Boot, SQL.';
extractJobData(text, 'https://example.com/job/123').then(d => console.log(JSON.stringify(d, null, 2)));
"
```
**Expected:** JSON with jobTitle='Java Developer', company='Infosys', location='Bangalore', etc.

### 3. Fake Job Detection Test
```bash
node -e "
require('dotenv').config({ path: './backend/.env' });
const { detectFakeJob } = require('./backend/src/ai/fakeJobDetector.service');
const fakeJob = { jobTitle: 'Work from Home', company: 'XYZ', salary: '50,000/day', applyLink: 'https://wa.me/9999999999', description: 'Send Rs. 500 registration fee to start working immediately' };
detectFakeJob(fakeJob).then(r => console.log(JSON.stringify(r, null, 2)));
"
```
**Expected:** `isFake: true`, riskLevel: 'high', reasons includes registration fee warning.

### 4. Duplicate Detection Test
```bash
node -e "
require('dotenv').config({ path: './backend/.env' });
const { checkDuplicate } = require('./backend/src/ai/duplicateDetector.service');
checkDuplicate({ jobTitle: 'Software Engineer', company: 'Infosys', location: 'Bangalore' }).then(r => console.log(JSON.stringify(r, null, 2)));
"
```

### 5. Slug Generation Test
```bash
node -e "
require('dotenv').config({ path: './backend/.env' });
const { generateSlug } = require('./backend/src/services/slug.service');
generateSlug({ company: 'Infosys', jobTitle: 'Java Developer', location: 'Bangalore, Pune' }).then(s => console.log('Slug:', s));
"
```
**Expected:** `infosys-java-developer-bangalore`

### 6. SEO Fields Test
```bash
node -e "
const { generateSeoFields } = require('./backend/src/services/seo.service');
const job = { jobTitle: 'Java Developer', company: 'Infosys', location: 'Bangalore', salary: '4-6 LPA', skills: ['Java', 'Spring Boot'] };
const seo = generateSeoFields(job, 'infosys-java-developer-bangalore');
console.log(JSON.stringify(seo, null, 2));
"
```

### 7. Scraper Registry Test
```bash
node -e "
require('dotenv').config({ path: './backend/.env' });
const registry = require('./backend/src/scrapers/registry');
console.log('Registered scrapers:', registry.getNames());
"
```
**Expected:** `['company-career-pages', 'govt-portals', 'freshersworld', 'internshala', 'unstop', 'google-jobs-jsonld']`

### 8. Walk-ins API Test
```bash
# Start server first, then:
curl "http://localhost:5000/api/walkins?period=week"
curl "http://localhost:5000/api/walkins?period=today"
```

### 9. Jobs Search API Test
```bash
curl "http://localhost:5000/api/jobs?q=java&limit=5"
curl "http://localhost:5000/api/jobs?walkin=true&period=today"
curl "http://localhost:5000/api/jobs?internship=true"
curl "http://localhost:5000/api/jobs?remote=true"
```

### 10. AI Assistant Test
```bash
curl -X POST http://localhost:5000/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "Find Java jobs in Bangalore above 5 LPA"}'
```
**Expected:** `{ reply: "...", jobs: [...], filters: {...} }`

### 11. Sitemap Test
```bash
curl "http://localhost:5000/sitemap.xml" | head -50
```
**Expected:** Valid XML with `<urlset>` and job URL entries.

---

## Integration Test: Full Scrape → Publish Pipeline

```bash
# 1. Preview extraction (no DB write)
curl -X POST http://localhost:5000/api/admin/scrape-job \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://career.infosys.com/jobs/search?tags=fresher"}'

# 2. Full scrape and save (writes to DB)
curl -X POST http://localhost:5000/api/admin/scrape-and-save \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "YOUR_JOB_URL"}'

# 3. Verify job was published
curl "http://localhost:5000/api/jobs?limit=1"
```

---

## Admin Dashboard Verification

After logging in as admin at `/admin`:

- [ ] Dashboard stats widget loads (jobs today, this week, walk-ins)
- [ ] Scraping Status panel shows recent runs from `scrape_logs`
- [ ] AI Logs panel shows Ollama/Groq call history
- [ ] Flagged Jobs panel shows `status=flagged_review` jobs with Approve button
- [ ] "Run Scrapers" button triggers manual scrape (super-admin only)
- [ ] Ollama Health panel shows model status

---

## Automated Test Scripts (create in backend/scripts/)

```bash
node backend/scripts/test-ollama.js     # Ollama health + extraction
node backend/scripts/test-scraper.js    # Each scraper plugin
node backend/scripts/test-pipeline.js   # Full end-to-end
```
