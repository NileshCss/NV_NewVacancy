'use strict';
const pdfParse  = require('pdf-parse');
const mammoth   = require('mammoth');
const crypto    = require('crypto');

/**
 * Universal resume text extractor
 * Handles PDF, DOCX, DOC, TXT — any quality
 */

/**
 * Extract text from PDF buffer
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function extractFromPDF(buffer) {
  try {
    const result = await pdfParse(buffer, {
      // Handle scanned + digital PDFs
      pagerender: (pageData) => {
        return pageData.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false,
        }).then((content) => {
          return content.items.map(i => i.str).join(' ');
        });
      },
    });

    let text = result.text || '';

    // Clean up common PDF artifacts
    text = text
      .replace(/\f/g, '\n')           // form feeds → newlines
      .replace(/\r\n/g, '\n')         // normalize line endings
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')            // tabs → spaces
      .replace(/ {3,}/g, '  ')        // collapse extra spaces
      .replace(/\n{4,}/g, '\n\n\n')   // collapse excess blank lines
      .trim();

    if (!text || text.length < 30) {
      throw new Error(
        'PDF appears to be scanned/image-based. ' +
        'Please export as text-based PDF or use DOCX format.'
      );
    }

    return text;
  } catch (err) {
    console.error('[ResumeParser][extractFromPDF]', err.message);
    throw new Error(`PDF extraction failed: ${err.message}`);
  }
}

/**
 * Extract text from DOCX/DOC buffer
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function extractFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });

    if (result.messages?.length > 0) {
      console.warn('[ResumeParser] DOCX warnings:', result.messages);
    }

    const text = result.value
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/ {3,}/g, '  ')
      .trim();

    if (!text || text.length < 30) {
      throw new Error('DOCX appears to be empty or unreadable.');
    }

    return text;
  } catch (err) {
    console.error('[ResumeParser][extractFromDOCX]', err.message);
    throw new Error(`DOCX extraction failed: ${err.message}`);
  }
}

/**
 * Extract text from plain text buffer
 * @param {Buffer} buffer
 * @returns {string}
 */
function extractFromTXT(buffer) {
  const text = buffer.toString('utf-8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (!text || text.length < 30) {
    throw new Error('Text file appears to be empty.');
  }

  return text;
}

/**
 * Universal file handler — detects format and extracts text
 * @param {Buffer} buffer    - File buffer
 * @param {string} mimetype  - MIME type of file
 * @param {string} filename  - Original filename
 * @returns {Promise<{text: string, hash: string, wordCount: number}>}
 */
async function extractResumeText(buffer, mimetype, filename) {
  let text = '';
  const ext = (filename || '').split('.').pop().toLowerCase();

  // Detect by MIME type OR extension
  const isPDF = mimetype === 'application/pdf' || ext === 'pdf';
  const isDOCX = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ].includes(mimetype) || ['docx', 'doc'].includes(ext);
  const isTXT = mimetype === 'text/plain' || ext === 'txt';

  if (isPDF) {
    text = await extractFromPDF(buffer);
  } else if (isDOCX) {
    text = await extractFromDOCX(buffer);
  } else if (isTXT) {
    text = extractFromTXT(buffer);
  } else {
    throw new Error(
      `Unsupported file format: ${ext || mimetype}. ` +
      'Please upload PDF, DOCX, DOC, or TXT.'
    );
  }

  // Generate hash for caching (SHA256 of file content)
  const hash = crypto.createHash('sha256')
    .update(buffer)
    .digest('hex')
    .slice(0, 16);

  return {
    text,
    hash,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    charCount: text.length,
    pages: Math.ceil(text.split(/\n/).length / 40),
  };
}

/**
 * Basic pre-validation before sending to AI
 * Catches obviously bad files early
 * @param {string} text
 * @returns {{ valid: boolean, reason: string }}
 */
function validateResumeText(text) {
  if (!text || text.trim().length < 100) {
    return { valid: false, reason: 'Resume is too short to analyze.' };
  }

  if (text.trim().length < 300) {
    return {
      valid: false,
      reason: 'Resume appears incomplete. Please upload your full resume.'
    };
  }

  // Must have at least one of: email pattern, name-like text, or skill keywords
  const hasEmail   = /@\w+\.\w+/.test(text);
  const hasPhone   = /\d{10}|\+\d{2}\s*\d{10}/.test(text);
  const hasName    = /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(text);

  if (!hasEmail && !hasPhone && !hasName) {
    return {
      valid: false,
      reason: 'File does not appear to be a resume. ' +
              'Please upload your CV/resume document.'
    };
  }

  return { valid: true, reason: '' };
}

module.exports = {
  extractResumeText,
  validateResumeText,
};
