// routes/convertRoutes.js

import express from 'express';
import { body, validationResult } from 'express-validator';
import { textConverterFactory } from '../services/converter/textConverterFactory.js';
import { config } from '../config/default.js';
import { AppError } from '../utils/errorHandler.js';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import JSZip from 'jszip';

/**
 * Router configuration and middleware setup
 */
const router = express.Router();

/**
 * Rate limiter configuration - 100 requests per minute
 */
const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.security.rateLimitPerMinute,
  message: 'Too many requests from this IP, please try again after a minute',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Multer storage and upload configuration
 */
const multerConfig = {
  storage: multer.memoryStorage(),
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
      console.error('File filter error:', error);
      cb(new AppError('Error processing file', 500));
    }
  }
};

const upload = multer(multerConfig).single('file');

/**
 * Validation middleware
 */
const validators = {
  apiKey: (req, _res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return next(new AppError('API key is required', 401));
    }

    if (!apiKey.startsWith('sk-')) {
      return next(new AppError('Invalid API key format', 401));
    }

    next();
  },

  file: [
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
  ],

  url: [
    body('url')
      .notEmpty()
      .withMessage('URL is required')
      .isURL()
      .withMessage('Invalid URL format')
  ],

  checkResult: (req, _res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400, errors.array()));
    }
    next();
  }
};

/**
 * Error handlers
 */
const errorHandlers = {
  multer: (error, _req, _res, next) => {
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
  },

  general: (err, _req, res, _next) => {
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
  }
};

/**
 * Conversion handlers
 */
const conversionHandlers = {
  file: async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }

      const fileType = req.body.fileType || 
        path.extname(req.file.originalname).toLowerCase().slice(1);

      console.log('Converting file:', {
        name: req.file.originalname,
        type: fileType
      });

      const result = await textConverterFactory.convertToMarkdown(
        fileType,
        req.file.buffer,
        req.file.originalname
      );

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
      console.error('File conversion error:', error);
      next(new AppError('File conversion failed', 500, error.message));
    }
  },

  url: async (req, res, next) => {
    try {
      const { url } = req.body;
      console.log('Converting URL:', url);

      const result = await textConverterFactory.convertToMarkdown(
        'url',
        url,
        new URL(url).hostname
      );

      res.json({
        success: true,
        content: result.content,
        images: result.images || [],
        metadata: {
          originalUrl: url,
          type: 'url'
        }
      });

    } catch (error) {
      console.error('URL conversion error:', error);
      next(new AppError(
        `URL conversion failed: ${error.message}`,
        500,
        error.stack
      ));
    }
  }
};

/**
 * Route handlers
 */
const routes = {
  health: (_req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      allowedTypes: config.conversion.allowedFileTypes,
      version: process.env.npm_package_version || '1.0.0'
    });
  }
};

// Apply rate limiter to all routes
router.use(rateLimiter);

// File conversion endpoint
router.post('/file',
  validators.apiKey,
  validators.file,
  (req, res, next) => {
    upload(req, res, err => {
      if (err) return errorHandlers.multer(err, req, res, next);
      conversionHandlers.file(req, res, next);
    });
  }
);

// URL conversion endpoint
router.post('/url',
  validators.apiKey,
  validators.url,
  validators.checkResult,
  conversionHandlers.url
);

// Health check endpoint
router.get('/health', routes.health);

// Error handling middleware
router.use(errorHandlers.general);

export default router;