export const SKILLS = {
  // ── Languages ─────────────────────────────────────
  languages: [
    'javascript','typescript','python','java','c','c++','c#',
    'php','ruby','swift','kotlin','go','rust','scala','r',
    'matlab','perl','bash','shell','powershell',
  ],

  // ── Frontend ──────────────────────────────────────
  frontend: [
    'react','vue','angular','nextjs','nuxt','svelte',
    'html','css','sass','scss','less','tailwind','bootstrap',
    'jquery','redux','zustand','webpack','vite','babel',
    'figma','responsive design','pwa',
  ],

  // ── Backend ───────────────────────────────────────
  backend: [
    'nodejs','express','django','flask','fastapi','spring',
    'laravel','rails','nestjs','graphql','rest api','soap',
    'microservices','websocket','grpc','api design',
  ],

  // ── Database ──────────────────────────────────────
  database: [
    'mysql','postgresql','mongodb','redis','firebase',
    'supabase','oracle','sql server','sqlite','dynamodb',
    'cassandra','elasticsearch','prisma','sequelize',
  ],

  // ── Cloud & DevOps ────────────────────────────────
  devops: [
    'aws','azure','gcp','docker','kubernetes','jenkins',
    'github actions','ci/cd','terraform','ansible','nginx',
    'linux','ubuntu','git','github','gitlab','bitbucket',
  ],

  // ── Mobile ────────────────────────────────────────
  mobile: [
    'react native','flutter','android','ios','kotlin',
    'swift','xamarin','ionic','expo',
  ],

  // ── Data & AI ─────────────────────────────────────
  data: [
    'machine learning','deep learning','tensorflow','pytorch',
    'pandas','numpy','scikit-learn','tableau','power bi',
    'data analysis','data science','nlp','computer vision',
    'opencv','spark','hadoop','data mining','statistics',
  ],

  // ── Testing ───────────────────────────────────────
  testing: [
    'jest','selenium','cypress','junit','mocha','chai',
    'postman','unit testing','integration testing',
    'test driven development','tdd','bdd',
  ],

  // ── Soft Skills ───────────────────────────────────
  soft: [
    'leadership','communication','teamwork','problem solving',
    'critical thinking','time management','creativity',
    'adaptability','project management','presentation',
    'analytical','negotiation','mentoring','agile','scrum',
  ],

  // ── Domain / Industry ─────────────────────────────
  domain: [
    'banking','finance','healthcare','ecommerce','logistics',
    'manufacturing','telecom','insurance','retail','media',
  ],
}

// Flat list of all skills for easy matching
export const ALL_SKILLS = Object.values(SKILLS).flat()

// High demand skills in Indian job market (score out of 100)
export const SKILL_DEMAND = {
  'javascript':95,'react':93,'python':92,'nodejs':88,
  'sql':87,'java':85,'aws':84,'git':90,'typescript':82,
  'docker':80,'machine learning':88,'data analysis':85,
  'mongodb':75,'angular':72,'kubernetes':76,'flutter':70,
}
