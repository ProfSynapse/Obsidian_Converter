// routes/convert/middleware/upload.js

import multer from 'multer';
import path from 'path';
import { AppError } from '../../utils/errorHandler.js';
import { config } from '../../config/default.js';

/**
 * Multer configuration for file uploads
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.conversion.maxFileSize,
    files: 10, // Increased for batch processing
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (!config.conversion.allowedFileTypes.includes(ext)) {
      return cb(
        new AppError(
          `Unsupported file type: ${ext}. Allowed types: ${config.conversion.allowedFileTypes.join(
            ', '
          )}`,
          400
        )
      );
    }
    cb(null, true);
  },
}).single('file');
