'use strict';

const { callOllama } = require('../ai/ollamaClient');
const logger = require('../utils/logger');

const SYSTEM_PROMPT = `
You are an expert exam question parser. You will extract exam questions from raw text.
You MUST output a JSON object containing a "questions" key with an array of objects.
Do not write any chat or commentary, output ONLY the valid JSON structure.

For each question:
- "question_text": The main question string.
- "question_type": Must be one of: "mcq", "multiple_correct", "true_false", "fill_blank", "assertion_reason", "match_following", "case_study", "scenario_based", "sql_output", "coding_mcq", "interview_question", "previous_year_question".
- "options": JSON array of option strings (for mcq, multiple_correct, etc.), or null.
- "correct_answer": JSON object with key "answer" (string/array) or "indices" (array of numbers, 0-indexed). E.g. {"answer": "Paris", "indices": [1]}
- "solution_text": Detailed solution or step-by-step math.
- "explanation": Short explanation of why the correct answer is right.
- "difficulty": "easy", "medium", or "hard".
- "marks": default 1.
- "negative_marks": default 0.

Example output:
{
  "questions": [
    {
      "question_text": "What is the capital of France?",
      "question_type": "mcq",
      "options": ["London", "Paris", "Berlin", "Rome"],
      "correct_answer": { "answer": "Paris", "indices": [1] },
      "solution_text": "Paris has been the capital since...",
      "explanation": "Paris is the capital of France.",
      "difficulty": "easy",
      "marks": 1,
      "negative_marks": 0.25
    }
  ]
}
`;

exports.extractQuestions = async (rawText) => {
  try {
    const result = await callOllama(SYSTEM_PROMPT, rawText);
    if (!result || !result.questions) {
      throw new Error("Invalid output format from AI");
    }
    return result.questions;
  } catch (err) {
    logger.error('Failed to extract questions via Ollama:', err);
    throw err;
  }
};
