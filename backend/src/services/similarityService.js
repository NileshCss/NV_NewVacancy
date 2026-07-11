'use strict';

/**
 * Calculates the Levenshtein distance between two strings.
 */
function levenshteinDistance(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array(an + 1).fill(null).map(() => Array(bn + 1).fill(0));
  for (let i = 0; i <= an; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= bn; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= an; i += 1) {
    for (let j = 1; j <= bn; j += 1) {
      const temp = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + temp // substitution
      );
    }
  }
  return matrix[an][bn];
}

/**
 * Calculates similarity coefficient (0 to 1) based on Levenshtein distance
 */
function calculateSimilarity(s1, s2) {
  const str1 = String(s1 || '').trim().toLowerCase();
  const str2 = String(s2 || '').trim().toLowerCase();
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(str1, str2);
  return (maxLen - distance) / maxLen;
}

/**
 * Checks a new question text against a list of existing questions.
 * Returns the duplicate question object if similarity is > 0.85, else null.
 */
exports.checkDuplicate = (newQuestionText, existingQuestions, threshold = 0.85) => {
  if (!newQuestionText || !existingQuestions || existingQuestions.length === 0) return null;
  
  for (const q of existingQuestions) {
    const score = calculateSimilarity(newQuestionText, q.question_text);
    if (score >= threshold) {
      return { id: q.id, question_text: q.question_text, similarity: score };
    }
  }
  return null;
};
