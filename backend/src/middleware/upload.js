'use strict';
const multer = require('multer');
const path   = require('path');

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10);

const ALLOWED_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'text/plain': '.txt',
};

const ALLOWED_EXTS = ['.pdf', '.docx', '.doc', '.txt'];

/**
 * File filter — validates type and extension
 */
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const typeOk = Boolean(ALLOWED_TYPES[file.mimetype]);
  const extOk  = ALLOWED_EXTS.includes(ext);

  if (typeOk || extOk) {
    cb(null, true);
  } else {
    cb(new Error(
      `Invalid file type: ${ext}. ` +
      'Allowed: .pdf, .docx, .doc, .txt'
    ));
  }
}

/**
 * Multer config — memory storage (no disk writes)
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_MB * 1024 * 1024,
    files:    1,
  },
  fileFilter,
});

/**
 * Single resume file upload middleware
 */
const uploadResume = upload.single('resume');

/**
 * Wrapper that handles multer errors gracefully
 */
function handleUpload(req, res, next) {
  uploadResume(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error:   `File too large. Maximum size is ${MAX_MB}MB.`,
          code:    'FILE_TOO_LARGE',
        });
      }
      return res.status(400).json({
        success: false,
        error:   err.message,
        code:    'UPLOAD_ERROR',
      });
    }
    if (err) {
      return res.status(400).json({
        success: false,
        error:   err.message,
        code:    'FILE_INVALID',
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error:   'No file uploaded. Please attach a resume file.',
        code:    'NO_FILE',
      });
    }
    next();
  });
}

module.exports = { handleUpload };
