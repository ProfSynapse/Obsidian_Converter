// routes/convertRoutes.js

import express from 'express';
import { body, validationResult } from 'express-validator';
import { textConverterFactory } from '../services/converter/textConverterFactory.js';
import { config } from '../config/default.js';
import { AppError } from '../utils/errorHandler.js';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import sanitize from 'sanitize-filename';

const router = express.Router();

/**
 * Rate limiter - 100 requests per minute
 */
const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.security.rateLimitPerMinute,
  message: 'Too many requests from this IP, please try again after a minute',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Multer configuration for file uploads
 */
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.conversion.maxFileSize,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    try {
      console.log('Processing file:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });

      const ext = path.extname(file.originalname).toLowerCase().slice(1);
      if (config.conversion.allowedFileTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new AppError(
          `Unsupported file type: ${ext}. Allowed types: ${config.conversion.allowedFileTypes.join(', ')}`,
          400
        ));
      }
    } catch (error) {
      console.error('Multer filter error:', error);
      cb(new AppError('Error processing file', 500));
    }
  }
}).single('file');

/**
 * Middleware to handle Multer errors
 */
function handleMulterError(error, _req, _res, next) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(
        `File size exceeds limit of ${config.conversion.maxFileSize / (1024 * 1024)}MB`,
        400
      ));
    }
    return next(new AppError(`Upload error: ${error.message}`, 400));
  }
  next(error);
}

/**
 * Validate API key middleware
 */
function validateApiKey(req, _res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return next(new AppError('API key is required', 401));
  }

  if (!apiKey.startsWith('sk-')) {
    return next(new AppError('Invalid API key format', 401));
  }

  next();
}

/**
 * Validation middleware for file conversion
 */
const validateFileConversion = [
  body('fileType')
    .optional()
    .isString()
    .withMessage('fileType must be a string')
    .custom(value => {
      if (value && !config.conversion.allowedFileTypes.includes(value)) {
        throw new Error(`Unsupported file type. Allowed types: ${config.conversion.allowedFileTypes.join(', ')}`);
      }
      return true;
    })
];

/**
 * Validation middleware for URL conversion
 */
const validateUrlConversion = [
  body('url')
    .notEmpty()
    .withMessage('URL is required')
    .isURL()
    .withMessage('Invalid URL format')
];

/**
 * Check validation results
 */
function checkValidationResult(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }
  next();
}

// routes/convertRoutes.js (add this function)

/**
 * Creates a ZIP file containing markdown and images
 * @param {Array} files - Array of converted files with their images
 * @returns {Promise<Buffer>} - ZIP file buffer
 */
async function createZipWithImages(files) {
  const zip = new JSZip();
  
  for (const file of files) {
    // Add markdown content
    zip.file(`${file.filename}`, file.content);
    
    // Process images if they exist
    if (file.images && file.images.length > 0) {
      const baseName = path.basename(file.filename, '.md');
      
      // Create images folder structure
      file.images.forEach(image => {
        const imagePath = `attachments/${baseName}/${image.name}`;
        const imageBuffer = Buffer.from(image.data, 'base64');
        zip.file(imagePath, imageBuffer);
      });
    }
  }
  
  return await zip.generateAsync({ type: 'nodebuffer' });
}

// Apply rate limiter to all routes
router.use(rateLimiter);

/**
 * Main file conversion endpoint
 * POST /api/v1/convert/file
 */
router.post('/file',
  validateApiKey,
  validateFileConversion,
  (req, res, next) => {
    upload(req, res, async (err) => {
      if (err) return handleMulterError(err, req, res, next);

      try {
        if (!req.file) {
          throw new AppError('No file uploaded', 400);
        }

        const fileType = req.body.fileType || 
          path.extname(req.file.originalname).toLowerCase().slice(1);

        // Convert the file using textConverterFactory
        const result = await textConverterFactory.convertToMarkdown(
          fileType,
          req.file.buffer,
          req.file.originalname
        );

        // Return the converted content and any images
        res.json({
          success: true,
          content: result.content,
          images: result.images || [],
          metadata: {
            originalName: req.file.originalname,
            type: fileType,
            hasImages: result.images?.length > 0
          }
        });

      } catch (error) {
        console.error('Conversion error:', error);
        next(new AppError(
          'File conversion failed',
          500,
          error.message
        ));
      }
    });
  }
);

/**
 * URL conversion endpoint
 * POST /api/v1/convert/url
 */
router.post('/url',
  validateApiKey,
  validateUrlConversion,
  checkValidationResult,
  async (req, res, next) => {
    try {
      const { url } = req.body;
      console.log('Converting URL:', url);

      const result = await textConverterFactory.convertToMarkdown(
        url,
        'url',
        `webpage-${Date.now()}.md`
      );

      res.json({
        success: true,
        content: result.content,
        images: result.images || [],
        metadata: {
          originalUrl: url,
          type: 'html'
        }
      });

    } catch (error) {
      next(new AppError(
        'URL conversion failed',
        500,
        error.message
      ));
    }
  }
);

/**
 * Health check endpoint
 * GET /api/v1/convert/health
 */
router.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    allowedTypes: config.conversion.allowedFileTypes,
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * Error handling middleware
 */
router.use((err, _req, res, _next) => {
  console.error('Route error:', {
    message: err.message,
    stack: err.stack,
    details: err.details
  });

  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      message: err.message,
      code: err.code || 'INTERNAL_ERROR',
      details: err.details || null
    }
  });
});

export default router;