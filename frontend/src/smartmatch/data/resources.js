// Free learning resources for each skill gap
export const LEARNING_RESOURCES = {
  'javascript':   { platform:'freeCodeCamp',   url:'freecodecamp.org', weeks:6  },
  'react':        { platform:'React Docs',      url:'react.dev',        weeks:4  },
  'python':       { platform:'Python.org',      url:'python.org',       weeks:6  },
  'nodejs':       { platform:'Node.js Docs',    url:'nodejs.org',       weeks:3  },
  'sql':          { platform:'SQLZoo',           url:'sqlzoo.net',       weeks:2  },
  'aws':          { platform:'AWS Free Tier',   url:'aws.amazon.com',   weeks:8  },
  'docker':       { platform:'Docker Docs',     url:'docker.com',       weeks:2  },
  'git':          { platform:'Git SCM',         url:'git-scm.com',      weeks:1  },
  'typescript':   { platform:'TS Handbook',     url:'typescriptlang.org',weeks:3 },
  'machine learning': { platform:'Coursera',   url:'coursera.org',     weeks:12 },
  'data analysis':    { platform:'Kaggle',      url:'kaggle.com',       weeks:4  },
  'flutter':      { platform:'Flutter Docs',    url:'flutter.dev',      weeks:5  },
  'default':      { platform:'Udemy / YouTube', url:'udemy.com',        weeks:3  },
}

export function getResource(skill) {
  return LEARNING_RESOURCES[skill.toLowerCase()] ||
         LEARNING_RESOURCES['default']
}
