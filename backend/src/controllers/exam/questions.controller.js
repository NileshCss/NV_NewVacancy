'use strict';

const { supabaseAdmin, supabaseRegular } = require('../../middleware/rbac');
const logger = require('../../utils/logger');
const similarityService = require('../../services/similarityService');
const questionExtractorService = require('../../services/questionExtractorService');
const Papa = require('papaparse');

// GET / - List Questions (Admin sees all, Public sees approved)
exports.listQuestions = async (req, res) => {
  try {
    const { exam_id, subject_id, chapter_id, topic_id, difficulty, status, search } = req.query;

    const isAdmin = req.user && ['admin', 'super_admin'].includes(req.user.role);
    const client = isAdmin ? supabaseAdmin : supabaseRegular;

    let query = client.from('questions').select('*, question_exam_map(exam_id, subject_id, chapter_id, topic_id)');

    if (!isAdmin) {
      query = query.eq('status', 'approved');
    } else if (status) {
      query = query.eq('status', status);
    }

    if (difficulty) query = query.eq('difficulty', difficulty);
    if (search) query = query.ilike('question_text', `%${search}%`);

    // We fetch and then filter locally for relations if needed, 
    // or use inner join if Supabase supports it, but post-filtering is easier here for a quick mock.
    const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
    if (error) throw error;

    let results = data;
    if (exam_id || subject_id || chapter_id || topic_id) {
      results = results.filter(q => {
        if (!q.question_exam_map || q.question_exam_map.length === 0) return false;
        return q.question_exam_map.some(map => {
          let match = true;
          if (exam_id && map.exam_id !== exam_id) match = false;
          if (subject_id && map.subject_id !== subject_id) match = false;
          if (chapter_id && map.chapter_id !== chapter_id) match = false;
          if (topic_id && map.topic_id !== topic_id) match = false;
          return match;
        });
      });
    }

    res.json({ success: true, data: results });
  } catch (err) {
    logger.error('Error listing questions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /:id
exports.getQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const client = req.user && ['admin', 'super_admin'].includes(req.user.role) ? supabaseAdmin : supabaseRegular;
    const { data, error } = await client.from('questions').select('*, question_exam_map(*)').eq('id', id).single();
    
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Question not found' });
    
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error fetching question:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /
exports.createQuestion = async (req, res) => {
  try {
    const payload = { ...req.body, created_by: req.user.id };
    
    // Check for duplicates
    const { data: existing } = await supabaseAdmin.from('questions').select('id, question_text').limit(1000);
    if (existing && existing.length > 0) {
      const isDuplicate = similarityService.checkDuplicate(payload.question_text, existing);
      if (isDuplicate) {
        payload.possible_duplicate_of = isDuplicate.id;
        payload.status = 'draft'; // Force draft if duplicate
      }
    }

    // Extract mapping data
    const mappings = payload.mappings || [];
    delete payload.mappings;

    const { data: qData, error: qError } = await supabaseAdmin.from('questions').insert([payload]).select().single();
    if (qError) throw qError;

    if (mappings.length > 0) {
      const mapsToInsert = mappings.map(m => ({ ...m, question_id: qData.id }));
      const { error: mapError } = await supabaseAdmin.from('question_exam_map').insert(mapsToInsert);
      if (mapError) throw mapError;
    }

    res.status(201).json({ success: true, data: qData });
  } catch (err) {
    logger.error('Error creating question:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /:id
exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body, updated_at: new Date().toISOString() };
    const mappings = payload.mappings;
    delete payload.mappings;

    const { data, error } = await supabaseAdmin.from('questions').update(payload).eq('id', id).select().single();
    if (error) throw error;

    if (mappings !== undefined) {
      // clear old mappings and insert new
      await supabaseAdmin.from('question_exam_map').delete().eq('question_id', id);
      if (mappings.length > 0) {
        const mapsToInsert = mappings.map(m => ({ ...m, question_id: id }));
        await supabaseAdmin.from('question_exam_map').insert(mapsToInsert);
      }
    }

    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error updating question:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /:id/status (Approve/Reject)
exports.updateQuestionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['approved', 'rejected', 'draft'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const { data, error } = await supabaseAdmin.from('questions')
      .update({ status, reviewed_by: req.user.id, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error updating status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /:id
exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('questions').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Question deleted' });
  } catch (err) {
    logger.error('Error deleting question:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /bulk-import
exports.bulkImportCsv = async (req, res) => {
  try {
    const { csvData, mappings } = req.body; // csvData is raw string
    if (!csvData) return res.status(400).json({ success: false, error: 'No CSV data provided' });

    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid CSV format' });
    }

    const { data: existing } = await supabaseAdmin.from('questions').select('id, question_text').limit(5000);
    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    let errorsList = [];

    // Log the import
    const { data: logEntry } = await supabaseAdmin.from('question_import_logs').insert([{
      imported_by: req.user.id,
      source_type: 'csv',
      total_processed: parsed.data.length
    }]).select().single();

    for (const row of parsed.data) {
      try {
        if (!row.question_text) { failedCount++; continue; }

        let possibleDup = null;
        if (existing) {
          const dup = similarityService.checkDuplicate(row.question_text, existing);
          if (dup) { possibleDup = dup.id; duplicateCount++; }
        }

        const qPayload = {
          question_text: row.question_text,
          question_type: row.question_type || 'mcq',
          options: row.options ? JSON.parse(row.options) : [],
          correct_answer: row.correct_answer ? JSON.parse(row.correct_answer) : {},
          difficulty: row.difficulty || 'medium',
          status: possibleDup ? 'draft' : 'approved',
          source: 'bulk_import',
          possible_duplicate_of: possibleDup,
          created_by: req.user.id
        };

        const { data: inserted, error: qErr } = await supabaseAdmin.from('questions').insert([qPayload]).select().single();
        if (qErr) throw qErr;

        if (mappings && mappings.length > 0) {
          const m = mappings.map(x => ({ ...x, question_id: inserted.id }));
          await supabaseAdmin.from('question_exam_map').insert(m);
        }
        successCount++;
      } catch (err) {
        failedCount++;
        errorsList.push(err.message);
      }
    }

    await supabaseAdmin.from('question_import_logs').update({
      success_count: successCount,
      failed_count: failedCount,
      duplicate_count: duplicateCount,
      errors: errorsList
    }).eq('id', logEntry.id);

    res.json({ success: true, data: { successCount, duplicateCount, failedCount } });
  } catch (err) {
    logger.error('Error bulk importing:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /extract-ai
exports.extractQuestionsAI = async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ success: false, error: 'rawText is required' });

    const extracted = await questionExtractorService.extractQuestions(rawText);
    res.json({ success: true, data: extracted });
  } catch (err) {
    logger.error('Error extracting questions via AI:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
