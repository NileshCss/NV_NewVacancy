'use strict';

/**
 * SmartMatch™ Skills Database
 * 200+ skills organized by category for the Indian tech market 2026
 */

const SKILLS_DB = {
  languages: [
    'java','javascript','typescript','python','c','c++','c#',
    'php','ruby','swift','kotlin','go','rust','scala','r',
    'matlab','perl','bash','shell','powershell','dart',
  ],
  frontend: [
    'react','react.js','reactjs','vue','vue.js','angular',
    'next.js','nextjs','nuxt','svelte','html','html5',
    'css','css3','sass','scss','less','tailwind','tailwind css',
    'bootstrap','material ui','jquery','redux','zustand',
    'webpack','vite','babel','pwa','responsive design',
    'figma','adobe xd',
  ],
  backend: [
    'node.js','nodejs','express','express.js','django','flask',
    'fastapi','spring','spring boot','spring mvc','spring security',
    'spring framework','laravel','rails','nestjs','nest.js',
    'graphql','rest api','rest apis','soap','grpc','websocket',
    'microservices','serverless','api design','servlet','jsp',
    'hibernate','hibernate jpa','jpa','jdbc',
  ],
  databases: [
    'mysql','postgresql','postgres','mongodb','redis',
    'firebase','supabase','oracle','sql server','sqlite',
    'dynamodb','cassandra','elasticsearch','neo4j',
    'prisma','sequelize','mongoose','typeorm','sql',
  ],
  cloud_devops: [
    'aws','azure','gcp','google cloud','docker','kubernetes','k8s',
    'jenkins','github actions','gitlab ci','circleci','ci/cd',
    'terraform','ansible','nginx','apache','linux','ubuntu',
    'git','github','gitlab','bitbucket','helm','prometheus',
    'grafana','sonarqube','jfrog','nexus',
  ],
  testing: [
    'junit','junit5','mockito','jest','mocha','chai',
    'selenium','cypress','postman','pytest','testng',
    'unit testing','integration testing','tdd','bdd',
    'test driven development','behavior driven development',
  ],
  mobile: [
    'react native','flutter','android','ios','kotlin','swift',
    'xamarin','ionic','expo',
  ],
  data_ai: [
    'machine learning','deep learning','tensorflow','pytorch',
    'keras','pandas','numpy','scikit-learn','scipy',
    'tableau','power bi','data analysis','data science',
    'nlp','computer vision','opencv','spark','hadoop',
    'data mining','statistics','matplotlib','seaborn',
  ],
  concepts: [
    'oop','object oriented programming','dsa','data structures',
    'algorithms','system design','design patterns','solid principles',
    'agile','scrum','kanban','sdlc','mvp','mvc architecture',
    'microservices architecture','event driven','domain driven',
    'jwt','oauth','oauth2','authentication','authorization','rbac',
    'problem solving','code review','pair programming',
    'apache kafka','kafka','rabbitmq','message queue',
    'load balancing','caching','cdn','redis caching',
  ],
  tools: [
    'git','vs code','intellij idea','eclipse','postman',
    'jira','confluence','slack','notion','figma',
    'linux','windows','macos',
  ],
};

// Flat list of ALL skills for quick matching
const ALL_SKILLS_FLAT = Object.values(SKILLS_DB).flat();

// Skills that carry extra ATS weight (compound phrases)
const COMPOUND_SKILLS = [
  'spring boot','rest api','rest apis','react.js','node.js',
  'express.js','spring security','spring mvc','github actions',
  'ci/cd','object oriented programming','data structures',
  'system design','hibernate jpa','apache kafka','tailwind css',
  'next.js','machine learning','deep learning','design patterns',
  'test driven development','behavior driven development',
];

// Company tier mapping for experience scoring
const COMPANY_TIERS = {
  1: {
    multiplier: 1.0,
    label: 'Tier 1 — Top Product',
    companies: [
      'amazon','google','microsoft','flipkart','razorpay',
      'phonepe','zomato','swiggy','meesho','cred','ola',
      'paytm','byju','unacademy','freshworks','zoho',
      'make my trip','nykaa','policybazaar','upstox','groww',
      'cars24','sharechat','dream11','postman',
    ],
  },
  2: {
    multiplier: 0.90,
    label: 'Tier 2 — Funded Startup / Product',
    companies: [
      'series a','series b','funded','startup','product company',
      'saas','newvacancy',
    ],
  },
  3: {
    multiplier: 0.80,
    label: 'Tier 3 — Large IT Services',
    companies: [
      'tcs','infosys','wipro','hcl','cognizant','capgemini',
      'accenture','tech mahindra','mphasis','hexaware',
      'l&t infotech','ltimindtree','persistent','coforge',
    ],
  },
  4: {
    multiplier: 0.65,
    label: 'Tier 4 — Mid-Market IT',
    companies: [
      'rcs technology','resource pro','elcamino','zensar',
      'mastech','kpit','cyient','sasken','quess',
    ],
  },
  5: {
    multiplier: 0.40,
    label: 'Tier 5 — Non-Tech / BPO / Training',
    companies: [
      'bpo','call center','training','institute','coaching',
      'insurance operations','data entry','moderation',
    ],
  },
};

// Keyword tiers for ATS keyword scoring
const KEYWORD_TIERS = {
  A: {
    points: 3,
    keywords: [
      'microservices','docker','kubernetes','kafka','redis',
      'aws','gcp','azure','ci/cd','system design','jwt',
      'oauth','oauth2','hibernate','jpa','junit','mockito',
      'typescript','graphql','rabbitmq','elasticsearch',
      'terraform','spring security','load balancing',
    ],
  },
  B: {
    points: 2,
    keywords: [
      'spring boot','react.js','rest api','node.js','postgresql',
      'mongodb','mysql','agile','scrum','git','devops',
      'tailwind','next.js','redux','spring','hibernate',
      'microservices','api design','java',
    ],
  },
  C: {
    points: 1,
    keywords: [
      'javascript','html','css','python','api','backend',
      'frontend','full stack','fullstack','database','sql',
      'linux','git','oop','dsa','algorithms',
    ],
  },
};

// Education level scores
const EDUCATION_SCORES = {
  'phd':        100, 'doctorate':  100,
  'mtech':       90, 'm.tech':      90,
  'me':          90, 'm.e':         90,
  'ms':          90, 'mca':         90,
  'mba':         85,
  'btech':       85, 'b.tech':      85,
  'be':          85, 'b.e':         85,
  'bca':         75, 'b.ca':        75,
  'bsc':         70, 'b.sc':        70,
  'bcom':        60, 'b.com':       60,
  'ba':          55,
  'diploma':     55,
  '12th':        40, 'hsc':         40,
  '10th':        30, 'ssc':         30,
};

module.exports = {
  SKILLS_DB,
  ALL_SKILLS_FLAT,
  COMPOUND_SKILLS,
  COMPANY_TIERS,
  KEYWORD_TIERS,
  EDUCATION_SCORES,
};
