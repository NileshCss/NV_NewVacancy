'use strict';

const { supabaseAdmin, supabaseRegular } = require('../../middleware/rbac');
const logger = require('../../utils/logger');
const similarityService = require('../../services/similarityService');
const questionExtractorService = require('../../services/questionExtractorService');
const Papa = require('papaparse');
const XLSX = require('xlsx');

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
    if (req.query.tag) query = query.contains('tags', [req.query.tag]);

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

// POST /import-file (Admin only)
exports.importFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const filename = req.file.originalname;
    const ext = filename.split('.').pop().toLowerCase();
    
    let sourceType = '';
    let parsedRows = [];
    let isAi = false;
    let rawPdfText = '';

    if (ext === 'xlsx' || ext === 'xls') {
      sourceType = 'excel';
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      parsedRows = XLSX.utils.sheet_to_json(sheet);
    } else if (ext === 'csv') {
      sourceType = 'csv';
      const csvString = req.file.buffer.toString('utf8');
      const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true });
      parsedRows = parsed.data;
    } else if (ext === 'pdf') {
      sourceType = 'pdf';
      isAi = true;
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(req.file.buffer);
      rawPdfText = data.text;
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported file format. Supported: .xlsx, .xls, .csv, .pdf' });
    }

    // Load existing questions for duplicate checks
    const { data: existingQuestions } = await supabaseAdmin.from('questions').select('id, question_text');

    // Create import log entry
    const { data: logEntry, error: logErr } = await supabaseAdmin.from('question_import_logs').insert([{
      imported_by: req.user.id,
      filename,
      source_type: sourceType,
      total_processed: isAi ? 0 : parsedRows.length
    }]).select().single();

    if (logErr) throw logErr;

    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    let errorsList = [];
    let unresolvedRefs = [];

    if (isAi) {
      // PDF Processing via Ollama AI extraction
      // Process in chunks of 8000 characters
      const chunkSize = 8000;
      let chunks = [];
      for (let i = 0; i < rawPdfText.length; i += chunkSize) {
        chunks.push(rawPdfText.substring(i, i + chunkSize));
      }

      console.log(`[PDF Import] Segmented PDF into ${chunks.length} chunks`);

      let totalExtracted = 0;
      for (let c = 0; c < chunks.length; c++) {
        try {
          const chunkText = chunks[c];
          console.log(`[PDF Import] Processing chunk ${c + 1}/${chunks.length}...`);
          const extractedList = await questionExtractorService.extractQuestions(chunkText);
          
          if (Array.isArray(extractedList)) {
            for (const item of extractedList) {
              totalExtracted++;
              try {
                if (!item.question_text) { failedCount++; continue; }

                let possibleDup = null;
                if (existingQuestions) {
                  const dup = similarityService.checkDuplicate(item.question_text, existingQuestions);
                  if (dup) { possibleDup = dup.id; duplicateCount++; }
                }

                // Check options format
                let options = item.options || [];
                // If it is array of objects {id, text}, map to array of strings
                if (options.length > 0 && typeof options[0] === 'object') {
                  options = options.map(o => o.text || o.id || String(o));
                }

                let correct_answer = item.correct_answer || {};
                if (Array.isArray(correct_answer)) {
                  // If it's just an array of indices or strings, format to standard {indices, answer}
                  correct_answer = { indices: correct_answer, answer: '' };
                }

                const qPayload = {
                  question_text: item.question_text,
                  question_type: item.question_type || 'mcq',
                  options,
                  correct_answer,
                  solution_text: item.solution_text || null,
                  explanation: item.explanation || null,
                  difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : 'medium',
                  status: 'draft',
                  source: 'ai_extracted',
                  possible_duplicate_of: possibleDup,
                  created_by: req.user.id,
                  marks: item.marks || 1,
                  negative_marks: item.negative_marks || 0,
                  tags: [`batch_${logEntry.id}`]
                };

                const { data: inserted, error: qErr } = await supabaseAdmin.from('questions').insert([qPayload]).select().single();
                if (qErr) throw qErr;

                successCount++;
              } catch (qErr) {
                failedCount++;
                errorsList.push(`[Chunk ${c+1}] Question ${totalExtracted}: ${qErr.message}`);
              }
            }
          }
        } catch (chunkErr) {
          console.error(`[PDF Import] Chunk ${c+1} failed to parse:`, chunkErr.message);
          errorsList.push(`[Chunk ${c+1}] Failed: ${chunkErr.message}`);
        }
      }

      // Update total processed in log
      await supabaseAdmin.from('question_import_logs').update({
        total_processed: totalExtracted
      }).eq('id', logEntry.id);

    } else {
      // Excel/CSV Processing
      // Fetch taxonomy data for resolution
      const { data: dbExams } = await supabaseAdmin.from('exams').select('id, name');
      const { data: dbSubjects } = await supabaseAdmin.from('subjects').select('id, name, exam_id');
      const { data: dbTopics } = await supabaseAdmin.from('topics').select('id, name, subject_id');

      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        try {
          const questionText = row.question_text || row.question;
          if (!questionText) {
            failedCount++;
            continue;
          }

          // Taxonomy resolution
          let resolvedExam = null;
          if (row.exam_name) {
            resolvedExam = dbExams?.find(e => e.name.trim().toLowerCase() === String(row.exam_name).trim().toLowerCase());
            if (!resolvedExam) unresolvedRefs.push({ row: i + 1, type: 'exam', name: row.exam_name });
          }

          let resolvedSubject = null;
          if (resolvedExam && row.subject_name) {
            resolvedSubject = dbSubjects?.find(s => s.exam_id === resolvedExam.id && s.name.trim().toLowerCase() === String(row.subject_name).trim().toLowerCase());
            if (!resolvedSubject) unresolvedRefs.push({ row: i + 1, type: 'subject', name: row.subject_name });
          }

          let resolvedTopic = null;
          if (resolvedSubject && row.topic_name) {
            resolvedTopic = dbTopics?.find(t => t.subject_id === resolvedSubject.id && t.name.trim().toLowerCase() === String(row.topic_name).trim().toLowerCase());
            if (!resolvedTopic) unresolvedRefs.push({ row: i + 1, type: 'topic', name: row.topic_name });
          }

          // Duplicate detection
          let possibleDup = null;
          if (existingQuestions) {
            const dup = similarityService.checkDuplicate(questionText, existingQuestions);
            if (dup) {
              possibleDup = dup.id;
              duplicateCount++;
            }
          }

          // Gather options
          const options = [];
          const optA = row.option_a || row.option_1 || row.optionA;
          const optB = row.option_b || row.option_2 || row.optionB;
          const optC = row.option_c || row.option_3 || row.optionC;
          const optD = row.option_d || row.option_4 || row.optionD;
          if (optA) options.push(String(optA));
          if (optB) options.push(String(optB));
          if (optC) options.push(String(optC));
          if (optD) options.push(String(optD));

          // Correct answer parsing
          let correctIndices = [];
          let correctAnswerText = '';
          const correctVal = String(row.correct_answer || row.answer || '').trim();
          if (correctVal.toLowerCase() === 'a' || correctVal === '0') {
            correctIndices = [0];
            correctAnswerText = options[0] || '';
          } else if (correctVal.toLowerCase() === 'b' || correctVal === '1') {
            correctIndices = [1];
            correctAnswerText = options[1] || '';
          } else if (correctVal.toLowerCase() === 'c' || correctVal === '2') {
            correctIndices = [2];
            correctAnswerText = options[2] || '';
          } else if (correctVal.toLowerCase() === 'd' || correctVal === '3') {
            correctIndices = [3];
            correctAnswerText = options[3] || '';
          } else {
            const idx = options.findIndex(o => o.trim().toLowerCase() === correctVal.toLowerCase());
            if (idx !== -1) {
              correctIndices = [idx];
              correctAnswerText = options[idx];
            }
          }

          const correct_answer = { indices: correctIndices, answer: correctAnswerText };

          // Build tags list
          let tagsList = [];
          if (row.tags) {
            tagsList = String(row.tags).split(',').map(t => t.trim()).filter(Boolean);
          }
          tagsList.push(`batch_${logEntry.id}`);

          const qPayload = {
            question_text: questionText,
            question_type: row.question_type || 'mcq',
            options: options.length > 0 ? options : null,
            correct_answer,
            explanation: row.explanation || null,
            solution_text: row.solution_text || null,
            difficulty: ['easy', 'medium', 'hard'].includes(row.difficulty) ? row.difficulty : 'medium',
            status: 'draft',
            source: 'bulk_import',
            possible_duplicate_of: possibleDup,
            created_by: req.user.id,
            marks: parseFloat(row.marks) || 1,
            negative_marks: parseFloat(row.negative_marks) || 0,
            tags: tagsList
          };

          const { data: inserted, error: qErr } = await supabaseAdmin.from('questions').insert([qPayload]).select().single();
          if (qErr) throw qErr;

          // Mapping
          if (resolvedExam) {
            await supabaseAdmin.from('question_exam_map').insert([{
              question_id: inserted.id,
              exam_id: resolvedExam.id,
              subject_id: resolvedSubject?.id || null,
              topic_id: resolvedTopic?.id || null
            }]);
          }

          successCount++;
        } catch (rowErr) {
          failedCount++;
          errorsList.push(`[Row ${i+1}] Error: ${rowErr.message}`);
        }
      }
    }

    // Save logs final results
    await supabaseAdmin.from('question_import_logs').update({
      success_count: successCount,
      failed_count: failedCount,
      duplicate_count: duplicateCount,
      errors: errorsList
    }).eq('id', logEntry.id);

    res.json({
      success: true,
      data: {
        total: isAi ? successCount + failedCount : parsedRows.length,
        successCount,
        duplicateCount,
        failedCount,
        unresolvedRefs,
        logId: logEntry.id
      }
    });

  } catch (err) {
    logger.error('Error importing file:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
