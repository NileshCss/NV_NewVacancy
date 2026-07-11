'use strict';

const { supabaseAdmin, supabaseRegular, getClientForRequest } = require('../../middleware/rbac');
const logger = require('../../utils/logger');
const similarityService = require('../../services/similarityService');
const questionExtractorService = require('../../services/questionExtractorService');
const Papa = require('papaparse');
const XLSX = require('xlsx');

// GET / - List Questions (Admin sees all, Public sees approved)
exports.listQuestions = async (req, res) => {
  try {
    const { exam_id, subject_id, chapter_id, topic_id, difficulty, status, search } = req.query;

    const client = getClientForRequest(req);
    let query = client.from('questions').select('*, question_exam_map(exam_id, subject_id, chapter_id, topic_id)');

    if (status) {
      query = query.eq('status', status);
    }

    if (difficulty) query = query.eq('difficulty', difficulty);
    if (search) query = query.ilike('question_text', `%${search}%`);
    if (req.query.tag) query = query.contains('tags', [req.query.tag]);

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
    const client = getClientForRequest(req);
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
    const client = getClientForRequest(req);
    
    // Check for duplicates
    const { data: existing } = await client.from('questions').select('id, question_text').limit(1000);
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

    const { data: qData, error: qError } = await client.from('questions').insert([payload]).select().single();
    if (qError) throw qError;

    if (mappings.length > 0) {
      const mapsToInsert = mappings.map(m => ({ ...m, question_id: qData.id }));
      const { error: mapError } = await client.from('question_exam_map').insert(mapsToInsert);
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
    const client = getClientForRequest(req);

    const { data, error } = await client.from('questions').update(payload).eq('id', id).select().single();
    if (error) throw error;

    if (mappings !== undefined) {
      // clear old mappings and insert new
      await client.from('question_exam_map').delete().eq('question_id', id);
      if (mappings.length > 0) {
        const mapsToInsert = mappings.map(m => ({ ...m, question_id: id }));
        await client.from('question_exam_map').insert(mapsToInsert);
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
    const client = getClientForRequest(req);

    const { data, error } = await client.from('questions')
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
    const client = getClientForRequest(req);
    const { error } = await client.from('questions').delete().eq('id', id);
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

    const client = getClientForRequest(req);
    const { data: existing } = await client.from('questions').select('id, question_text').limit(5000);
    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    let errorsList = [];

    // Log the import
    const { data: logEntry } = await client.from('question_import_logs').insert([{
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

        const { data: inserted, error: qErr } = await client.from('questions').insert([qPayload]).select().single();
        if (qErr) throw qErr;

        if (mappings && mappings.length > 0) {
          const m = mappings.map(x => ({ ...x, question_id: inserted.id }));
          await client.from('question_exam_map').insert(m);
        }
        successCount++;
      } catch (err) {
        failedCount++;
        errorsList.push(err.message);
      }
    }

    await client.from('question_import_logs').update({
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

    const client = getClientForRequest(req);
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
    const { data: existingQuestions } = await client.from('questions').select('id, question_text');

    // Create import log entry
    const { data: logEntry, error: logErr } = await client.from('question_import_logs').insert([{
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

                const { data: inserted, error: qErr } = await client.from('questions').insert([qPayload]).select().single();
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
      await client.from('question_import_logs').update({
        total_processed: totalExtracted
      }).eq('id', logEntry.id);

    } else {
      // Excel/CSV Processing
      const examId = req.body.examId;
      if (!examId) {
        return res.status(400).json({ success: false, error: 'Target examId is required for file import' });
      }

      // Fetch taxonomy data for resolution (scoped under the target examId)
      let { data: dbSubjects } = await client.from('subjects').select('id, name').eq('exam_id', examId);
      if (!dbSubjects) dbSubjects = [];

      // Cache objects to prevent repetitive database calls inside the loop
      const chaptersCache = {};
      const topicsCache = {};

      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        try {
          const questionText = row.question || row.Question || row.question_text;
          if (!questionText) {
            failedCount++;
            continue;
          }

          // Taxonomy resolution (Subject -> Chapter -> Topic)
          let resolvedSubject = null;
          let resolvedChapter = null;
          let resolvedTopic = null;

          const subjectName = (row.Subject || row.subject || row.subject_name || '').trim();
          if (subjectName) {
            // Find in loaded list
            resolvedSubject = dbSubjects.find(s => s.name.trim().toLowerCase() === subjectName.toLowerCase());
            if (!resolvedSubject) {
              // Create it!
              const { data: newSub, error: subErr } = await client
                .from('subjects')
                .insert([{ exam_id: examId, name: subjectName, enabled: true }])
                .select()
                .single();
              if (subErr) throw new Error(`Failed to create Subject "${subjectName}": ${subErr.message}`);
              resolvedSubject = newSub;
              dbSubjects.push(newSub);
            }

            // Resolve Chapter (maps to CSV Topic)
            const chapterName = (row.Topic || row.topic || row.topic_name || '').trim();
            if (chapterName && resolvedSubject) {
              // Fetch chapters under this subject (use cache)
              if (!chaptersCache[resolvedSubject.id]) {
                let { data: dbChapters } = await client.from('chapters').select('id, name').eq('subject_id', resolvedSubject.id);
                chaptersCache[resolvedSubject.id] = dbChapters || [];
              }
              const dbChapters = chaptersCache[resolvedSubject.id];

              resolvedChapter = dbChapters.find(c => c.name.trim().toLowerCase() === chapterName.toLowerCase());
              if (!resolvedChapter) {
                // Create it!
                const { data: newChap, error: chapErr } = await client
                  .from('chapters')
                  .insert([{ subject_id: resolvedSubject.id, name: chapterName }])
                  .select()
                  .single();
                if (chapErr) throw new Error(`Failed to create Chapter "${chapterName}": ${chapErr.message}`);
                resolvedChapter = newChap;
                dbChapters.push(newChap);
              }

              // Resolve Topic (maps to CSV Subtopic)
              const topicName = (row.Subtopic || row.subtopic || row.subtopic_name || '').trim();
              if (topicName && resolvedChapter) {
                // Fetch topics under this chapter (use cache)
                if (!topicsCache[resolvedChapter.id]) {
                  let { data: dbTopics } = await client.from('topics').select('id, name').eq('chapter_id', resolvedChapter.id);
                  topicsCache[resolvedChapter.id] = dbTopics || [];
                }
                const dbTopics = topicsCache[resolvedChapter.id];

                resolvedTopic = dbTopics.find(t => t.name.trim().toLowerCase() === topicName.toLowerCase());
                if (!resolvedTopic) {
                  // Create it!
                  const { data: newTopic, error: topicErr } = await client
                    .from('topics')
                    .insert([{ chapter_id: resolvedChapter.id, name: topicName }])
                    .select()
                    .single();
                  if (topicErr) throw new Error(`Failed to create Topic "${topicName}": ${topicErr.message}`);
                  resolvedTopic = newTopic;
                  dbTopics.push(newTopic);
                }
              }
            }
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
          const optA = row.option_a || row.Option_A || row.optionA;
          const optB = row.option_b || row.Option_B || row.optionB;
          const optC = row.option_c || row.Option_C || row.optionC;
          const optD = row.option_d || row.Option_D || row.optionD;
          if (optA !== undefined) options.push(String(optA));
          if (optB !== undefined) options.push(String(optB));
          if (optC !== undefined) options.push(String(optC));
          if (optD !== undefined) options.push(String(optD));

          // Correct answer parsing
          let correctIndices = [];
          let correctAnswerText = '';
          const correctVal = String(row.correct_answer || row.Correct_Answer || row.answer || '').trim().toUpperCase();
          if (correctVal === 'A' || correctVal === '0') {
            correctIndices = [0];
            correctAnswerText = options[0] || '';
          } else if (correctVal === 'B' || correctVal === '1') {
            correctIndices = [1];
            correctAnswerText = options[1] || '';
          } else if (correctVal === 'C' || correctVal === '2') {
            correctIndices = [2];
            correctAnswerText = options[2] || '';
          } else if (correctVal === 'D' || correctVal === '3') {
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

          // Build tags list (semicolon split)
          let tagsList = [];
          const rawTags = row.tags || row.Tags || '';
          if (rawTags) {
            tagsList = String(rawTags).split(';').map(t => t.trim()).filter(Boolean);
          }
          tagsList.push(`batch_${logEntry.id}`);

          // Check interview relevance
          const interviewLevel = String(row.interview_level || row.Interview_Level || '').trim().toLowerCase();
          if (interviewLevel === 'yes' || interviewLevel === 'true' || interviewLevel === '1') {
            tagsList.push('interview-relevant');
          }

          // Build hints (Shortcut + Memory_Tip)
          const hints = [];
          const shortcut = row.shortcut || row.Shortcut;
          if (shortcut) hints.push(`Shortcut: ${shortcut}`);
          const memoryTip = row.memory_tip || row.Memory_Tip;
          if (memoryTip) hints.push(`Memory Tip: ${memoryTip}`);
          const hint = hints.join(' | ') || null;

          // Build reference (Previous_Year_Source + Previous_Year_Exam)
          const refParts = [];
          const pySource = row.previous_year_source || row.Previous_Year_Source;
          if (pySource) refParts.push(pySource);
          const pyExam = row.previous_year_exam || row.Previous_Year_Exam;
          if (pyExam) refParts.push(pyExam);
          const reference = refParts.join(' - ') || null;

          // Option explanations
          const option_explanations = {
            a: row.why_a_wrong || row.Why_A_Wrong || null,
            b: row.why_b_wrong || row.Why_B_Wrong || null,
            c: row.why_c_wrong || row.Why_C_Wrong || null,
            d: row.why_d_wrong || row.Why_D_Wrong || null
          };

          // Question Type normalization
          const qTypeVal = String(row.question_type || row.Question_Type || 'mcq').trim().toLowerCase();
          const question_type = ['mcq', 'msq', 'nat', 'true_false', 'assertion_reason'].includes(qTypeVal) ? qTypeVal : 'mcq';

          // Difficulty normalization
          const diffVal = String(row.difficulty || row.Difficulty || 'medium').trim().toLowerCase();
          const difficulty = ['easy', 'medium', 'hard'].includes(diffVal) ? diffVal : 'medium';

          const qPayload = {
            question_text: questionText,
            question_type,
            options: options.length > 0 ? options : null,
            correct_answer,
            explanation: row.explanation || row.Explanation || null,
            solution_text: row.solution_text || row.Solution_Text || null,
            difficulty,
            status: 'draft',
            source: 'bulk_import',
            possible_duplicate_of: possibleDup,
            created_by: req.user.id,
            marks: parseFloat(row.marks || row.Marks) || 1,
            negative_marks: parseFloat(row.negative_marks || row.Negative_Marks) || 0,
            tags: tagsList,
            
            // New database columns
            external_id: row.question_id || row.Question_ID || null,
            option_explanations,
            related_concept: row.related_concept || row.Related_Concept || null,
            exam_relevance_score: parseFloat(row.expected_cil_probability || row.Expected_CIL_Probability) || null,
            bloom_level: row.bloom_level || row.Bloom_Level || null,
            estimated_time_seconds: parseInt(row.estimated_time_seconds || row.Estimated_Time_Seconds) || null,
            hint,
            formula: row.formula || row.Formula || null,
            reference,
            year: parseInt(row.previous_year_year || row.Previous_Year_Year) || null
          };

          const { data: inserted, error: qErr } = await client.from('questions').insert([qPayload]).select().single();
          if (qErr) throw qErr;

          // Mapping
          if (examId) {
            await client.from('question_exam_map').insert([{
              question_id: inserted.id,
              exam_id: examId,
              subject_id: resolvedSubject?.id || null,
              chapter_id: resolvedChapter?.id || null,
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
    await client.from('question_import_logs').update({
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
        logId: logEntry.id,
        errors: errorsList
      }
    });

  } catch (err) {
    logger.error('Error importing file:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
