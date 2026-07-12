'use strict';

const { supabaseAdmin, getClientForRequest } = require('../../middleware/rbac');
const logger = require('../../utils/logger');

// Helper to check if an answer is correct
const isAnswerCorrect = (question, selectedAnswer) => {
  if (selectedAnswer === undefined || selectedAnswer === null) return false;
  
  const correct = question.correct_answer;
  if (!correct) return false;

  // Case 1: MCQ / multiple_correct (indices based)
  if (correct.indices && Array.isArray(correct.indices)) {
    let selectedIndices = [];
    if (Array.isArray(selectedAnswer)) {
      selectedIndices = selectedAnswer;
    } else if (selectedAnswer && Array.isArray(selectedAnswer.indices)) {
      selectedIndices = selectedAnswer.indices;
    } else if (selectedAnswer !== undefined && selectedAnswer !== null) {
      selectedIndices = [selectedAnswer];
    }
    
    if (selectedIndices.length !== correct.indices.length) return false;
    const correctSet = new Set(correct.indices.map(String));
    return selectedIndices.every(val => correctSet.has(String(val)));
  }

  // Case 2: String/Text answer
  const selectedStr = typeof selectedAnswer === 'object' ? (selectedAnswer.answer || selectedAnswer.value || '') : String(selectedAnswer);
  const correctStr = typeof correct === 'object' ? (correct.answer || correct.value || '') : String(correct);

  return String(selectedStr).trim().toLowerCase() === String(correctStr).trim().toLowerCase();
};

// ── GET /api/exam/mock-tests/student/list ─────────────────────────────────────
// Returns all published mock tests and includes the student's attempts history
exports.listMockTests = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { exam_id, status: attemptStatusFilter, subject_id, search } = req.query;
    const client = getClientForRequest(req);

    // 1. Fetch published mock tests
    let query = client
      .from('mock_tests')
      .select(`
        id, name, difficulty, duration_minutes, total_questions, total_marks,
        status, publish_date, expiry_date, question_selection_mode, instructions,
        exams:exam_id(id, name),
        subjects:subject_id(id, name)
      `)
      .eq('status', 'published');

    if (exam_id) query = query.eq('exam_id', exam_id);
    if (subject_id) query = query.eq('subject_id', subject_id);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data: tests, error: testsErr } = await query;
    if (testsErr) throw testsErr;

    // 2. Fetch all student attempts for the student
    const { data: attempts, error: attemptsErr } = await client
      .from('student_attempts')
      .select('*')
      .eq('student_id', studentId);

    if (attemptsErr) throw attemptsErr;

    // Map attempts to their tests
    const testsWithAttempts = (tests || []).map(test => {
      // Find attempts for this test
      const testAttempts = (attempts || []).filter(a => a.mock_test_id === test.id);
      
      // Sort attempts: completed preferred, then latest started_at
      testAttempts.sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return -1;
        if (a.status !== 'completed' && b.status === 'completed') return 1;
        return new Date(b.started_at) - new Date(a.started_at);
      });

      const latestAttempt = testAttempts[0] || null;

      return {
        ...test,
        latest_attempt: latestAttempt,
        all_attempts: testAttempts
      };
    });

    // Filter by attempt status if specified
    // 'not_attempted' | 'in_progress' | 'completed'
    let filtered = testsWithAttempts;
    if (attemptStatusFilter === 'not_attempted') {
      filtered = testsWithAttempts.filter(t => !t.latest_attempt);
    } else if (attemptStatusFilter === 'in_progress') {
      filtered = testsWithAttempts.filter(t => t.latest_attempt?.status === 'in_progress');
    } else if (attemptStatusFilter === 'completed') {
      filtered = testsWithAttempts.filter(t => t.latest_attempt?.status === 'completed');
    }

    res.json({ success: true, data: filtered });
  } catch (err) {
    logger.error('[StudentMockTests] listMockTests error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/exam/mock-tests/student/:id/detail ───────────────────────────────
// Get test details (without questions)
exports.getMockTest = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = req.user.id;
    const client = getClientForRequest(req);

    const { data: test, error: testErr } = await client
      .from('mock_tests')
      .select(`
        *,
        exams:exam_id(id, name),
        subjects:subject_id(id, name)
      `)
      .eq('id', id)
      .eq('status', 'published')
      .single();

    if (testErr) throw testErr;
    if (!test) return res.status(404).json({ success: false, error: 'Published mock test not found' });

    // Fetch student's latest attempt for this test
    const { data: attempt, error: attemptErr } = await client
      .from('student_attempts')
      .select('*')
      .eq('student_id', studentId)
      .eq('mock_test_id', id)
      .order('started_at', { ascending: false })
      .limit(1);

    res.json({ success: true, data: { ...test, latest_attempt: attempt?.[0] || null } });
  } catch (err) {
    logger.error('[StudentMockTests] getMockTest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/exam/mock-tests/student/:id/start ───────────────────────────────
// Start a new test or resume an existing in-progress attempt
exports.startMockTestAttempt = async (req, res) => {
  try {
    const { id: mock_test_id } = req.params;
    const studentId = req.user.id;
    const client = getClientForRequest(req);

    // 1. Fetch test
    const { data: test, error: testErr } = await client
      .from('mock_tests')
      .select('*')
      .eq('id', mock_test_id)
      .eq('status', 'published')
      .single();

    if (testErr || !test) return res.status(404).json({ success: false, error: 'Mock test not found or not published' });

    // 2. Check if user already has an in-progress attempt
    const { data: existingAttempts, error: extErr } = await client
      .from('student_attempts')
      .select('*')
      .eq('student_id', studentId)
      .eq('mock_test_id', mock_test_id)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false });

    let attempt = null;

    if (existingAttempts && existingAttempts.length > 0) {
      attempt = existingAttempts[0];
      
      // Verify if remaining time is expired
      const remainingMs = (test.duration_minutes * 60 * 1000) - (new Date() - new Date(attempt.started_at));
      if (remainingMs <= 0) {
        // Auto-submit backend check: force close the attempt
        const submitResult = await forceSubmitAttempt(client, attempt.id, test.duration_minutes);
        return res.status(400).json({
          success: false,
          error: 'Test time has already expired. Attempt has been auto-submitted.',
          code: 'TIME_EXPIRED',
          attempt: submitResult
        });
      }
    } else {
      // Create new attempt
      const { data: newAttempt, error: insErr } = await client
        .from('student_attempts')
        .insert([{
          student_id: studentId,
          mock_test_id,
          status: 'in_progress',
          started_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insErr) throw insErr;
      attempt = newAttempt;

      // Increment attempt count on mock_test
      await client.rpc('increment_mock_test_attempts_count', { test_id: mock_test_id }).catch(err => {
        // Fallback if rpc doesn't exist
        client.from('mock_tests').update({ attempts_count: (test.attempts_count || 0) + 1 }).eq('id', mock_test_id).then();
      });
    }

    // 3. Fetch questions but STRIP security-sensitive fields (correct_answer, explanation, solution_text, option_explanations)
    const { data: testQuestions, error: qErr } = await client
      .from('mock_test_questions')
      .select(`
        id, display_order, marks,
        questions:question_id(
          id, question_text, question_type, options,
          difficulty, marks, negative_marks, tags, formula, hint, code_block, image_url, diagram_url
        )
      `)
      .eq('mock_test_id', mock_test_id)
      .order('display_order', { ascending: true });

    if (qErr) throw qErr;

    // 4. Fetch already saved answers for this attempt (if resume)
    const { data: answers, error: ansErr } = await client
      .from('student_answers')
      .select('question_id, selected_answer, marked_for_review, time_spent_seconds')
      .eq('attempt_id', attempt.id);

    if (ansErr) throw ansErr;

    res.json({
      success: true,
      data: {
        attempt,
        test,
        questions: (testQuestions || []).map(tq => ({
          id: tq.questions.id,
          question_text: tq.questions.question_text,
          question_type: tq.questions.question_type,
          options: tq.questions.options,
          difficulty: tq.questions.difficulty,
          marks: tq.marks || tq.questions.marks || 1,
          negative_marks: tq.questions.negative_marks || 0,
          tags: tq.questions.tags || [],
          formula: tq.questions.formula,
          hint: tq.questions.hint,
          code_block: tq.questions.code_block,
          image_url: tq.questions.image_url,
          diagram_url: tq.questions.diagram_url,
          display_order: tq.display_order
        })),
        answers: answers || []
      }
    });
  } catch (err) {
    logger.error('[StudentMockTests] startMockTestAttempt error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/exam/mock-tests/student/attempts/:attemptId/save-answer ──────────
// Save student answer immediately
exports.saveMockTestAnswer = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { question_id, selected_answer, marked_for_review, time_spent_seconds } = req.body;
    const studentId = req.user.id;
    const client = getClientForRequest(req);

    // 1. Verify attempt ownership and in_progress status
    const { data: attempt, error: attErr } = await client
      .from('student_attempts')
      .select('*, mock_tests(duration_minutes)')
      .eq('id', attemptId)
      .single();

    if (attErr || !attempt) return res.status(404).json({ success: false, error: 'Attempt not found' });
    if (attempt.student_id !== studentId) return res.status(403).json({ success: false, error: 'Access denied' });
    if (attempt.status !== 'in_progress') return res.status(400).json({ success: false, error: 'Attempt is already submitted' });

    // 2. Validate time limit
    const durationMin = attempt.mock_tests?.duration_minutes || 60;
    const timeLimitMs = durationMin * 60 * 1000;
    const timePassedMs = new Date() - new Date(attempt.started_at);

    if (timePassedMs > (timeLimitMs + 120000)) { // 2 minute grace period
      // Auto-submit
      const submitResult = await forceSubmitAttempt(client, attemptId, durationMin);
      return res.status(400).json({
        success: false,
        error: 'Time limit exceeded. Attempt has been auto-submitted.',
        code: 'TIME_EXPIRED',
        attempt: submitResult
      });
    }

    // 3. Upsert answer
    const answerPayload = {
      attempt_id: attemptId,
      question_id,
      selected_answer,
      marked_for_review: !!marked_for_review,
      time_spent_seconds: parseInt(time_spent_seconds) || 0,
      updated_at: new Date().toISOString()
    };

    const { data, error: upsertErr } = await client
      .from('student_answers')
      .upsert([answerPayload], { onConflict: 'attempt_id,question_id' })
      .select()
      .single();

    if (upsertErr) throw upsertErr;

    res.json({ success: true, data });
  } catch (err) {
    logger.error('[StudentMockTests] saveMockTestAnswer error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/exam/mock-tests/student/attempts/:attemptId/tab-switch ──────────
// Log tab switches
exports.logTabSwitch = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const studentId = req.user.id;
    const client = getClientForRequest(req);

    const { data: attempt, error: attErr } = await client
      .from('student_attempts')
      .select('id, student_id, status, tab_switch_count')
      .eq('id', attemptId)
      .single();

    if (attErr || !attempt) return res.status(404).json({ success: false, error: 'Attempt not found' });
    if (attempt.student_id !== studentId) return res.status(403).json({ success: false, error: 'Access denied' });
    if (attempt.status !== 'in_progress') return res.status(400).json({ success: false, error: 'Attempt is not active' });

    const newCount = (attempt.tab_switch_count || 0) + 1;
    const { data, error: updErr } = await client
      .from('student_attempts')
      .update({ tab_switch_count: newCount, updated_at: new Date().toISOString() })
      .eq('id', attemptId)
      .select()
      .single();

    if (updErr) throw updErr;

    res.json({ success: true, tab_switch_count: newCount });
  } catch (err) {
    logger.error('[StudentMockTests] logTabSwitch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/exam/mock-tests/student/attempts/:attemptId/submit ──────────────
// Submit and score test server-side
exports.submitMockTest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const studentId = req.user.id;
    const client = getClientForRequest(req);

    // 1. Verify attempt ownership and in_progress status
    const { data: attempt, error: attErr } = await client
      .from('student_attempts')
      .select('*, mock_tests(*)')
      .eq('id', attemptId)
      .single();

    if (attErr || !attempt) return res.status(404).json({ success: false, error: 'Attempt not found' });
    if (attempt.student_id !== studentId) return res.status(403).json({ success: false, error: 'Access denied' });
    if (attempt.status !== 'in_progress') return res.status(400).json({ success: false, error: 'Attempt has already been submitted' });

    const durationMin = attempt.mock_tests?.duration_minutes || 60;
    const result = await forceSubmitAttempt(client, attemptId, durationMin);

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[StudentMockTests] submitMockTest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Helper function to submit and calculate scores server-side
async function forceSubmitAttempt(client, attemptId, durationMin) {
  // 1. Load mock test details and its correct answers
  const { data: testQuestions, error: tqErr } = await client
    .from('mock_test_questions')
    .select(`
      question_id, display_order, marks,
      questions:question_id(
        id, question_text, question_type, correct_answer, marks, negative_marks
      )
    `)
    .eq('mock_test_id', (
      await client.from('student_attempts').select('mock_test_id').eq('id', attemptId).single()
    ).data.mock_test_id);

  if (tqErr) throw tqErr;

  // 2. Fetch answers saved by student
  const { data: savedAnswers, error: ansErr } = await client
    .from('student_answers')
    .select('*')
    .eq('attempt_id', attemptId);

  if (ansErr) throw ansErr;

  // 3. Load attempt to verify start date
  const { data: attempt } = await client
    .from('student_attempts')
    .select('*')
    .eq('id', attemptId)
    .single();

  const mockTest = await client.from('mock_tests').select('negative_marking_ratio').eq('id', attempt.mock_test_id).single().then(r => r.data);

  const start = new Date(attempt.started_at);
  const now = new Date();
  const timeTakenSec = Math.min(
    Math.round((now - start) / 1000),
    durationMin * 60
  );

  // Time cutoff check: only count answers submitted within the test duration (+ grace period of 2 min)
  const cutoffTime = new Date(start.getTime() + (durationMin * 60 * 1000) + 120000);

  let totalCorrect = 0;
  let totalIncorrect = 0;
  let totalUnattempted = 0;
  let computedScore = 0;

  const answerCheckPromises = (testQuestions || []).map(async (tq) => {
    const question = tq.questions;
    const studentAns = (savedAnswers || []).find(sa => sa.question_id === question.id);
    
    // Check if unattempted
    const isUnattempted = !studentAns || 
                          studentAns.selected_answer === undefined || 
                          studentAns.selected_answer === null ||
                          (Array.isArray(studentAns.selected_answer) && studentAns.selected_answer.length === 0);

    // Exclude if answered after cutoff time
    const answeredAfterCutoff = studentAns && new Date(studentAns.updated_at || studentAns.answered_at) > cutoffTime;

    if (isUnattempted || answeredAfterCutoff) {
      totalUnattempted++;
      // Update DB record to mark correctness as false, marks_obtained as 0
      if (studentAns) {
        await client
          .from('student_answers')
          .update({ is_correct: false, marks_obtained: 0 })
          .eq('id', studentAns.id);
      }
      return;
    }

    const correct = isAnswerCorrect(question, studentAns.selected_answer);
    const qMarks = parseFloat(tq.marks || question.marks || 1);
    
    let marksObtained = 0;
    if (correct) {
      totalCorrect++;
      marksObtained = qMarks;
      computedScore += qMarks;
    } else {
      totalIncorrect++;
      const qNegRatio = parseFloat(mockTest?.negative_marking_ratio || 0);
      const qNegMarks = question.negative_marks ? parseFloat(question.negative_marks) : (qMarks * qNegRatio);
      marksObtained = -1 * qNegMarks;
      computedScore -= qNegMarks;
    }

    // Save correctness and score obtained server-side
    await client
      .from('student_answers')
      .update({ is_correct: correct, marks_obtained: parseFloat(marksObtained.toFixed(2)) })
      .eq('id', studentAns.id);
  });

  await Promise.all(answerCheckPromises);

  const accuracy = (totalCorrect + totalIncorrect) > 0 ? (totalCorrect / (totalCorrect + totalIncorrect)) : 0;

  // 4. Update student attempt status to completed
  const { data: updatedAttempt, error: updErr } = await client
    .from('student_attempts')
    .update({
      status: 'completed',
      completed_at: now.toISOString(),
      score: parseFloat(computedScore.toFixed(2)),
      accuracy_ratio: parseFloat(accuracy.toFixed(4)),
      total_correct: totalCorrect,
      total_incorrect: totalIncorrect,
      total_unattempted: totalUnattempted,
      time_taken_seconds: timeTakenSec,
      updated_at: now.toISOString()
    })
    .eq('id', attemptId)
    .select()
    .single();

  if (updErr) throw updErr;
  return updatedAttempt;
}

// ── GET /api/exam/mock-tests/student/attempts/:attemptId/result ───────────────
// Get full attempt results with correct answers and explanations
exports.getMockTestResult = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const studentId = req.user.id;
    const client = getClientForRequest(req);

    // 1. Fetch attempt and details
    const { data: attempt, error: attErr } = await client
      .from('student_attempts')
      .select('*, mock_tests(*, exams(name), subjects(name))')
      .eq('id', attemptId)
      .single();

    if (attErr || !attempt) return res.status(404).json({ success: false, error: 'Attempt not found' });
    if (attempt.student_id !== studentId && !req.user.role === 'admin' && !req.user.role === 'super_admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // 2. Fetch all questions with correct answers & explanations
    const { data: testQuestions, error: qErr } = await client
      .from('mock_test_questions')
      .select(`
        id, display_order, marks,
        questions:question_id(
          id, question_text, question_type, options, correct_answer,
          explanation, difficulty, marks, negative_marks, tags, formula, hint, code_block, image_url, diagram_url
        )
      `)
      .eq('mock_test_id', attempt.mock_test_id)
      .order('display_order', { ascending: true });

    if (qErr) throw qErr;

    // 3. Fetch student's answers
    const { data: answers, error: ansErr } = await client
      .from('student_answers')
      .select('*')
      .eq('attempt_id', attemptId);

    if (ansErr) throw ansErr;

    // 4. Calculate rank/percentile
    const { data: allAttempts, error: allErr } = await client
      .from('student_attempts')
      .select('id, score, time_taken_seconds')
      .eq('mock_test_id', attempt.mock_test_id)
      .eq('status', 'completed')
      .order('score', { ascending: false })
      .order('time_taken_seconds', { ascending: true });

    let rank = 1;
    let percentile = 100;
    let totalCompleted = 0;

    if (allAttempts && allAttempts.length > 0) {
      totalCompleted = allAttempts.length;
      const myIdx = allAttempts.findIndex(a => a.id === attemptId);
      if (myIdx !== -1) {
        rank = myIdx + 1;
        percentile = totalCompleted > 1 ? (((totalCompleted - rank) / (totalCompleted - 1)) * 100) : 100;
      }
    }

    const processedQuestions = (testQuestions || []).map(tq => {
      const question = tq.questions;
      const ans = (answers || []).find(a => a.question_id === question.id) || null;
      return {
        ...question,
        display_order: tq.display_order,
        marks_allocated: tq.marks || question.marks || 1,
        student_answer: ans
      };
    });

    res.json({
      success: true,
      data: {
        attempt: {
          ...attempt,
          rank,
          percentile: parseFloat(percentile.toFixed(2)),
          total_test_takers: totalCompleted
        },
        questions: processedQuestions
      }
    });
  } catch (err) {
    logger.error('[StudentMockTests] getMockTestResult error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/exam/mock-tests/student/:id/leaderboard ──────────────────────────
// Fetch leaderboard for a given test
exports.getMockTestLeaderboard = async (req, res) => {
  try {
    const { id: mock_test_id } = req.params;
    const studentId = req.user.id;
    const client = getClientForRequest(req);

    // Fetch top 50 attempts
    const { data: topAttempts, error: topErr } = await client
      .from('student_attempts')
      .select(`
        id, student_id, score, time_taken_seconds, completed_at,
        profiles:student_id(full_name, email)
      `)
      .eq('mock_test_id', mock_test_id)
      .eq('status', 'completed')
      .order('score', { ascending: false })
      .order('time_taken_seconds', { ascending: true })
      .limit(50);

    if (topErr) throw topErr;

    // Format top attempts (masking/display name processing)
    const leaderboard = (topAttempts || []).map((att, idx) => {
      const name = att.profiles?.full_name || att.profiles?.email?.split('@')[0] || 'Anonymous';
      return {
        rank: idx + 1,
        student_id: att.student_id,
        name,
        score: att.score,
        time_taken_seconds: att.time_taken_seconds,
        completed_at: att.completed_at
      };
    });

    // Find current student's best rank
    const { data: allAttempts, error: allErr } = await client
      .from('student_attempts')
      .select('id, student_id, score, time_taken_seconds')
      .eq('mock_test_id', mock_test_id)
      .eq('status', 'completed')
      .order('score', { ascending: false })
      .order('time_taken_seconds', { ascending: true });

    if (allErr) throw allErr;

    let studentRankInfo = null;
    if (allAttempts && allAttempts.length > 0) {
      const idx = allAttempts.findIndex(a => a.student_id === studentId);
      if (idx !== -1) {
        studentRankInfo = {
          rank: idx + 1,
          score: allAttempts[idx].score,
          time_taken_seconds: allAttempts[idx].time_taken_seconds,
          total_test_takers: allAttempts.length
        };
      }
    }

    res.json({
      success: true,
      data: {
        leaderboard,
        studentRank: studentRankInfo
      }
    });
  } catch (err) {
    logger.error('[StudentMockTests] getMockTestLeaderboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
