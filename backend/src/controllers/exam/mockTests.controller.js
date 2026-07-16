'use strict';

const { supabaseAdmin, getClientForRequest } = require('../../middleware/rbac');
const logger = require('../../utils/logger');


// Try to import the question extractor service (Ollama pipeline)
let questionExtractorService = null;
try {
  questionExtractorService = require('../../services/questionExtractorService');
} catch (e) {
  logger.warn('[MockTestsController] questionExtractorService not found — AI suggest mode will be unavailable');
}

// ── GET /api/exam/mock-tests ──────────────────────────────────────────────────
exports.listMockTests = async (req, res) => {
  try {
    const { exam_id, status, search } = req.query;
    const client = getClientForRequest(req);

    let query = client
      .from('mock_tests')
      .select(`
        id, name, difficulty, duration_minutes, total_questions, total_marks,
        status, publish_date, expiry_date, attempts_count, question_selection_mode,
        created_at, updated_at,
        exams:exam_id(id, name),
        subjects:subject_id(id, name)
      `)
      .order('created_at', { ascending: false });

    if (exam_id) query = query.eq('exam_id', exam_id);
    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    logger.error('[MockTestsController] listMockTests error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/exam/mock-tests/:id ──────────────────────────────────────────────
exports.getMockTest = async (req, res) => {
  try {
    const { id } = req.params;
    const client = getClientForRequest(req);

    const { data: test, error: testErr } = await client
      .from('mock_tests')
      .select(`
        *,
        exams:exam_id(id, name),
        subjects:subject_id(id, name),
        chapters:chapter_id(id, name)
      `)
      .eq('id', id)
      .single();

    if (testErr) throw testErr;
    if (!test) return res.status(404).json({ success: false, error: 'Mock test not found' });

    // Fetch associated questions with their details
    const { data: testQuestions, error: qErr } = await client
      .from('mock_test_questions')
      .select(`
        id, display_order, marks,
        questions:question_id(
          id, question_text, question_type, options, correct_answer,
          difficulty, status, explanation, marks, negative_marks, tags
        )
      `)
      .eq('mock_test_id', id)
      .order('display_order', { ascending: true });

    if (qErr) throw qErr;

    res.json({ success: true, data: { ...test, questions: testQuestions || [] } });
  } catch (err) {
    logger.error('[MockTestsController] getMockTest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/exam/mock-tests ─────────────────────────────────────────────────
exports.createMockTest = async (req, res) => {
  try {
    const client = getClientForRequest(req);
    const payload = {
      name: req.body.name,
      exam_id: req.body.exam_id || null,
      subject_id: req.body.subject_id || null,
      chapter_id: req.body.chapter_id || null,
      difficulty: req.body.difficulty || 'mixed',
      duration_minutes: parseInt(req.body.duration_minutes) || 60,
      total_questions: parseInt(req.body.total_questions) || 0,
      total_marks: parseInt(req.body.total_marks) || 0,
      passing_marks: req.body.passing_marks ? parseInt(req.body.passing_marks) : null,
      negative_marking_ratio: parseFloat(req.body.negative_marking_ratio) || 0,
      instructions: req.body.instructions || null,
      question_selection_mode: req.body.question_selection_mode || 'manual',
      random_rules: req.body.random_rules || [],
      status: 'draft',
      publish_date: req.body.publish_date || null,
      expiry_date: req.body.expiry_date || null,
      created_by: req.user.id,
    };

    if (!payload.name) {
      return res.status(400).json({ success: false, error: 'Test name is required' });
    }

    const { data, error } = await client
      .from('mock_tests')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (err) {
    logger.error('[MockTestsController] createMockTest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── PATCH /api/exam/mock-tests/:id ───────────────────────────────────────────
exports.updateMockTest = async (req, res) => {
  try {
    const { id } = req.params;
    const client = getClientForRequest(req);

    // Prevent edits to published tests that have active attempts (soft-lock)
    const { data: existing } = await client
      .from('mock_tests')
      .select('status, attempts_count')
      .eq('id', id)
      .single();

    if (existing?.status === 'published' && (existing?.attempts_count || 0) > 0) {
      // Allow metadata edits but not structural changes
      const allowedFields = ['name', 'instructions', 'expiry_date', 'publish_date'];
      const requestedFields = Object.keys(req.body);
      const blockedFields = requestedFields.filter(f => !allowedFields.includes(f));
      if (blockedFields.length > 0) {
        return res.status(409).json({
          success: false,
          error: `Cannot modify structural fields [${blockedFields.join(', ')}] of a published test with active attempts. Only name, instructions, and dates can be changed.`,
          code: 'PUBLISHED_TEST_LOCKED',
        });
      }
    }

    const payload = { ...req.body, updated_at: new Date().toISOString() };
    // Ensure status can't be directly set here (use publish endpoint)
    delete payload.status;

    const { data, error } = await client
      .from('mock_tests')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    logger.error('[MockTestsController] updateMockTest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── DELETE /api/exam/mock-tests/:id ──────────────────────────────────────────
exports.deleteMockTest = async (req, res) => {
  try {
    const { id } = req.params;
    const client = getClientForRequest(req);

    const { data: existing } = await client
      .from('mock_tests')
      .select('status, attempts_count, name')
      .eq('id', id)
      .single();

    if (existing?.status === 'published' && (existing?.attempts_count || 0) > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete "${existing.name}" — it is published and has ${existing.attempts_count} student attempts. Expire it instead.`,
        code: 'PUBLISHED_TEST_HAS_ATTEMPTS',
      });
    }

    const { error } = await client.from('mock_tests').delete().eq('id', id);
    if (error) throw error;

    res.json({ success: true, message: 'Mock test deleted' });
  } catch (err) {
    logger.error('[MockTestsController] deleteMockTest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/exam/mock-tests/:id/publish ─────────────────────────────────────
exports.publishMockTest = async (req, res) => {
  try {
    const { id } = req.params;
    const client = getClientForRequest(req);

    // Fetch test with full question list
    const { data: test, error: testErr } = await client
      .from('mock_tests')
      .select('*, mock_test_questions(question_id, questions:question_id(status, marks))')
      .eq('id', id)
      .single();

    if (testErr) throw testErr;
    if (!test) return res.status(404).json({ success: false, error: 'Mock test not found' });

    const questions = test.mock_test_questions || [];
    const errors = [];

    // Validation 1: question count matches
    if (questions.length !== test.total_questions) {
      errors.push(`Question count mismatch: test requires ${test.total_questions} questions but ${questions.length} are selected.`);
    }

    // Validation 2: all questions must be approved
    const unapproved = questions.filter(q => q.questions?.status !== 'approved');
    if (unapproved.length > 0) {
      errors.push(`${unapproved.length} question(s) are not approved. All questions must have status='approved' before publishing.`);
    }

    // Validation 3: duration and marks
    if (!test.duration_minutes || test.duration_minutes < 1) {
      errors.push('Duration (minutes) must be set and greater than 0.');
    }
    if (!test.total_marks || test.total_marks < 1) {
      errors.push('Total marks must be set and greater than 0.');
    }



    if (errors.length > 0) {
      return res.status(422).json({
        success: false,
        error: `Publish validation failed: ${errors.join('; ')}`,
        validation_errors: errors,
      });
    }

    // All good — publish
    const { data: published, error: pubErr } = await client
      .from('mock_tests')
      .update({
        status: 'published',
        publish_date: test.publish_date || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (pubErr) throw pubErr;

    res.json({ success: true, message: `"${test.name}" published successfully`, data: published });
  } catch (err) {
    logger.error('[MockTestsController] publishMockTest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/exam/mock-tests/:id/questions — Add a question ─────────────────
exports.addQuestion = async (req, res) => {
  try {
    const { id: mock_test_id } = req.params;
    const { question_id, display_order, marks } = req.body;

    if (!question_id) {
      return res.status(400).json({ success: false, error: 'question_id is required' });
    }

    const client = getClientForRequest(req);

    // Check it's approved
    const { data: q } = await client
      .from('questions')
      .select('id, status')
      .eq('id', question_id)
      .single();

    if (!q) return res.status(404).json({ success: false, error: 'Question not found' });
    if (q.status !== 'approved') {
      return res.status(422).json({ success: false, error: `Question must be approved (current status: ${q.status})` });
    }

    // Get next display_order if not provided
    let order = display_order;
    if (order === undefined || order === null) {
      const { count } = await client
        .from('mock_test_questions')
        .select('id', { count: 'exact' })
        .eq('mock_test_id', mock_test_id);
      order = (count || 0);
    }

    const { data, error } = await client
      .from('mock_test_questions')
      .insert([{ mock_test_id, question_id, display_order: order, marks: marks || 1 }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'This question is already in the test' });
      }
      throw error;
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    logger.error('[MockTestsController] addQuestion error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── DELETE /api/exam/mock-tests/:id/questions/:qid ──────────────────────────
exports.removeQuestion = async (req, res) => {
  try {
    const { id: mock_test_id, qid } = req.params;
    const client = getClientForRequest(req);

    const { error } = await client
      .from('mock_test_questions')
      .delete()
      .eq('mock_test_id', mock_test_id)
      .eq('question_id', qid);

    if (error) throw error;

    res.json({ success: true, message: 'Question removed from test' });
  } catch (err) {
    logger.error('[MockTestsController] removeQuestion error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── PATCH /api/exam/mock-tests/:id/questions/reorder ────────────────────────
exports.reorderQuestions = async (req, res) => {
  try {
    const { id: mock_test_id } = req.params;
    const { items } = req.body; // [{ question_id, display_order }]

    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'items must be an array of { question_id, display_order }' });
    }

    const client = getClientForRequest(req);

    // Batch update display_order
    await Promise.all(
      items.map(item =>
        client
          .from('mock_test_questions')
          .update({ display_order: item.display_order })
          .eq('mock_test_id', mock_test_id)
          .eq('question_id', item.question_id)
      )
    );

    res.json({ success: true, message: 'Questions reordered' });
  } catch (err) {
    logger.error('[MockTestsController] reorderQuestions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/exam/mock-tests/:id/questions/batch — Sync all questions in one batch ─────────────────
exports.batchSyncQuestions = async (req, res) => {
  try {
    const { id: mock_test_id } = req.params;
    const { questions } = req.body; // [{ question_id, display_order, marks }]

    if (!Array.isArray(questions)) {
      return res.status(400).json({ success: false, error: 'questions must be an array' });
    }

    const client = getClientForRequest(req);

    // 1. Fetch current questions
    const { data: current, error: currentErr } = await client
      .from('mock_test_questions')
      .select('question_id')
      .eq('mock_test_id', mock_test_id);

    if (currentErr) throw currentErr;

    const currentIds = new Set((current || []).map(q => q.question_id));
    const newIds = new Set(questions.map(q => q.question_id));

    // 2. Identify deletions
    const toDelete = (current || []).filter(q => !newIds.has(q.question_id)).map(q => q.question_id);
    if (toDelete.length > 0) {
      const { error: delErr } = await client
        .from('mock_test_questions')
        .delete()
        .eq('mock_test_id', mock_test_id)
        .in('question_id', toDelete);
      if (delErr) throw delErr;
    }

    // 3. Identify insertions / updates
    const upsertRows = questions.map(q => ({
      mock_test_id,
      question_id: q.question_id,
      display_order: q.display_order,
      marks: q.marks || 1
    }));

    if (upsertRows.length > 0) {
      const { error: upsertErr } = await client
        .from('mock_test_questions')
        .upsert(upsertRows, { onConflict: 'mock_test_id,question_id' });
      if (upsertErr) throw upsertErr;
    }

    res.json({ success: true, message: 'Mock test questions synced successfully' });
  } catch (err) {
    logger.error('[MockTestsController] batchSyncQuestions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/exam/mock-tests/:id/random-generate ────────────────────────────
// rules: [{ subject_id?, difficulty?, count }]
exports.generateRandomQuestions = async (req, res) => {
  try {
    const { id: mock_test_id } = req.params;
    const { rules } = req.body; // [{ subject_id?, difficulty?, count }]

    if (!Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({ success: false, error: 'rules must be a non-empty array' });
    }

    const client = getClientForRequest(req);

    // Fetch the test to know its exam_id
    const { data: test } = await client
      .from('mock_tests')
      .select('id, exam_id')
      .eq('id', mock_test_id)
      .single();

    if (!test) return res.status(404).json({ success: false, error: 'Mock test not found' });

    const allPicked = [];

    for (const rule of rules) {
      const { subject_id, difficulty, count } = rule;
      const ruleCount = parseInt(count) || 0;
      if (ruleCount < 1) continue;

      // Build query for approved questions matching this rule
      let q = client
        .from('question_exam_map')
        .select('question_id, questions!inner(id, question_text, question_type, difficulty, status, marks)')
        .eq('questions.status', 'approved');

      if (test.exam_id) q = q.eq('exam_id', test.exam_id);
      if (subject_id) q = q.eq('subject_id', subject_id);
      if (difficulty) q = q.eq('questions.difficulty', difficulty);

      const { data: matches, error: matchErr } = await q.limit(500);
      if (matchErr) throw matchErr;

      // Exclude already-selected questions
      const picked = allPicked.map(p => p.question_id);
      const available = (matches || []).filter(m => !picked.includes(m.question_id));

      // Fisher-Yates shuffle and take first `ruleCount`
      for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
      }

      allPicked.push(...available.slice(0, ruleCount));
    }

    res.json({
      success: true,
      data: allPicked.map((item, idx) => ({
        question_id: item.question_id,
        display_order: idx,
        marks: item.questions?.marks || 1,
        question: item.questions,
      })),
      count: allPicked.length,
    });
  } catch (err) {
    logger.error('[MockTestsController] generateRandomQuestions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/exam/mock-tests/:id/ai-suggest ─────────────────────────────────
// AI proposes questions from the question bank — admin must review before saving
exports.aiSuggestQuestions = async (req, res) => {
  try {
    if (!questionExtractorService) {
      return res.status(503).json({
        success: false,
        error: 'AI suggestion service is unavailable. Ensure Ollama is running and questionExtractorService is configured.',
      });
    }

    const { id: mock_test_id } = req.params;
    const { context } = req.body; // Optional: exam context, topics, objectives

    const client = getClientForRequest(req);

    // Fetch test details
    const { data: test } = await client
      .from('mock_tests')
      .select('*, exams:exam_id(name), subjects:subject_id(name)')
      .eq('id', mock_test_id)
      .single();

    if (!test) return res.status(404).json({ success: false, error: 'Mock test not found' });

    // Fetch approved questions for this exam/subject to give AI context
    let qQuery = supabaseAdmin
      .from('question_exam_map')
      .select('question_id, questions!inner(id, question_text, question_type, difficulty, status, tags)')
      .eq('questions.status', 'approved');

    if (test.exam_id) qQuery = qQuery.eq('exam_id', test.exam_id);
    if (test.subject_id) qQuery = qQuery.eq('subject_id', test.subject_id);

    const { data: qPool } = await qQuery.limit(200);
    const pool = (qPool || []).map(m => m.questions).filter(Boolean);

    if (pool.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'No approved questions found for this exam/subject combination. Add approved questions to the question bank first.',
      });
    }

    // Build AI prompt
    const examName = test.exams?.name || 'the exam';
    const subjectName = test.subjects?.name || 'all subjects';
    const contextText = context || `Select ${test.total_questions} balanced questions for a ${test.duration_minutes}-minute ${examName} test on ${subjectName}. Prefer mixed difficulty distribution.`;

    const questionsListText = pool.slice(0, 80).map((q, i) =>
      `${i + 1}. [${q.question_type}|${q.difficulty}] ${q.question_text.substring(0, 100)}`
    ).join('\n');

    const prompt = `You are a test curator. Given the following available questions (by number), select the best ${test.total_questions} questions for this test.\n\nContext: ${contextText}\n\nAvailable Questions:\n${questionsListText}\n\nRespond with ONLY a JSON array of question numbers (1-indexed integers) that you select. Example: [1, 3, 7, 12]`;

    let suggestedIndices = [];
    try {
      const aiResponse = await questionExtractorService.extractQuestions(prompt);
      // Parse the response — look for a JSON array
      const match = JSON.stringify(aiResponse).match(/\[[\d,\s]+\]/);
      if (match) {
        suggestedIndices = JSON.parse(match[0]).map(n => parseInt(n) - 1);
      }
    } catch (aiErr) {
      logger.warn('[MockTestsController] AI suggest failed:', aiErr.message);
    }

    // Fall back to first N if AI parsing failed
    if (suggestedIndices.length === 0) {
      suggestedIndices = Array.from({ length: Math.min(test.total_questions, pool.length) }, (_, i) => i);
    }

    const suggested = suggestedIndices
      .filter(idx => idx >= 0 && idx < pool.length)
      .slice(0, test.total_questions)
      .map((idx, order) => ({
        question_id: pool[idx].id,
        display_order: order,
        marks: 1,
        question: pool[idx],
      }));

    res.json({
      success: true,
      data: suggested,
      count: suggested.length,
      note: 'AI-suggested questions. Admin must review and confirm before saving to the test.',
    });
  } catch (err) {
    logger.error('[MockTestsController] aiSuggestQuestions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
