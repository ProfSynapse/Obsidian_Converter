// routes/middleware/validators.js

import { body, validationResult } from 'express-validator';
import { AppError } from '../../utils/errorHandler.js';
import { config } from '../../config/default.js';

/**
 * Normalizes a URL by adding https:// if missing
 */
const normalizeUrl = (url) => {
    if (!url) return url;
    const trimmed = url.trim().replace(/\s+/g, '');
    return !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
};

/**
 * Validates URL format
 */
const validateUrl = (url) => {
    try {
        new URL(normalizeUrl(url));
        return true;
    } catch (error) {
        throw new Error('Invalid URL format');
    }
};

/**
 * Validates YouTube URL format
 */
const validateYoutubeUrl = (url) => {
    const normalized = normalizeUrl(url);
    const regex = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/;
    
    if (!regex.test(normalized)) {
        throw new Error('Invalid YouTube URL format');
    }
    return true;
};

/**
 * Validation result checker
 */
const checkResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      console.log('Validation Failures:', {
          body: req.body,
          errors: errors.array()
      });
      
      return next(new AppError('Validation failed', 400, {
          errors: errors.array().map(err => ({
              field: err.param,
              message: err.msg,
              value: err.value,
              location: err.location
          }))
      }));
  }
  next();
};

// Export validators object with all validation rules
const validators = {
    // File validation
    file: [
        body('fileType')
            .optional()
            .isString()
            .withMessage('fileType must be a string')
            .custom((value) => {
                if (value && !config.conversion.allowedFileTypes.includes(value.toLowerCase())) {
                    throw new Error(
                        `Unsupported file type. Allowed types: ${config.conversion.allowedFileTypes.join(', ')}`
                    );
                }
                return true;
            })
    ],

    // URL validation
    url: [
      body('url')
          .exists()
          .withMessage('URL is required')
          .notEmpty()
          .withMessage('URL cannot be empty')
          .isString()
          .withMessage('URL must be a string')
          .customSanitizer(url => {
              // Match frontend normalization
              const trimmed = url.trim().replace(/\s+/g, '');
              return !/^https?:\/\//i.test(trimmed) ? 
                  `https://${trimmed}` : trimmed;
          })
          .custom((url) => {
              try {
                  new URL(url);
                  return true;
              } catch (error) {
                  throw new Error('Invalid URL format');
              }
          })
  ],


    // Parent URL validation
    parenturl: [
        body('parenturl')
            .trim()
            .notEmpty()
            .withMessage('Parent URL is required')
            .isString()
            .withMessage('Parent URL must be a string')
            .customSanitizer(normalizeUrl)
            .custom(validateUrl)
    ],

    // YouTube URL validation
    youtube: [
        body('url')
            .trim()
            .notEmpty()
            .withMessage('YouTube URL is required')
            .isString()
            .withMessage('YouTube URL must be a string')
            .customSanitizer(normalizeUrl)
            .custom(validateYoutubeUrl)
    ],

    // Batch validation
    batch: [
        body('items')
            .isArray()
            .withMessage('Items must be an array')
            .notEmpty()
            .withMessage('Items array cannot be empty'),
        body('items.*.type')
            .isString()
            .withMessage('Each item must have a type')
            .isIn(['file', 'url', 'parenturl', 'youtube'])
            .withMessage('Invalid item type'),
        body('items.*.content')
            .notEmpty()
            .withMessage('Each item must have content'),
        body('items.*.name')
            .notEmpty()
            .withMessage('Each item must have a name')
    ],

    // Export the result checker
    checkResult
};

export const validateConversion = (req, res, next) => {
    const validationType = req.path.split('/').pop();
    const validationChain = validators[validationType] || validators.file;
    
    Promise.all(validationChain.map(validation => validation.run(req)))
        .then(() => validators.checkResult(req, res, next))
        .catch(next);
};

// Export both validators and validateConversion
export { validators };