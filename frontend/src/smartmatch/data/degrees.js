export const DEGREES = {
  postgraduate: [
    'phd','doctorate','post doctoral','m.tech','mtech',
    'mca','mba','m.sc','msc','m.a','ma','llm','m.com','mcom',
    'pgdm','pg diploma',
  ],

  graduate: [
    'b.tech','btech','bca','bsc','b.sc','b.a','ba','bba',
    'bcom','b.com','llb','be','b.e','b.ed','bed',
  ],

  diploma: [
    'diploma','polytechnic','iti','vocational',
  ],

  school: [
    '12th','hsc','intermediate','plus two','+2',
    '10th','ssc','matriculation','cbse','icse',
  ],
}

// Score each level for ATS calculation
export const DEGREE_SCORES = {
  postgraduate: 100,
  graduate:      85,
  diploma:       65,
  school:        45,
  unknown:       35,
}

// Detect level from string
export function getDegreeLevel(text) {
  const lower = text.toLowerCase()
  for (const [level, list] of Object.entries(DEGREES)) {
    if (list.some(d => lower.includes(d))) return level
  }
  return 'unknown'
}
