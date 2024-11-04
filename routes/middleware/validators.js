// routes/convert/middleware/validators.js

import { body, validationResult } from 'express-validator';
import { AppError } from '../../utils/errorHandler.js';
import { config } from '../../config/default.js';

const normalizeUrl = (url) => {
    if (!/^https?:\/\//i.test(url)) {
      return 'https://' + url;
    }
    return url;
  };

export const validators = {
  file: [
    body('fileType')
      .optional()
      .isString()
      .withMessage('fileType must be a string')
      .custom((value) => {
        if (
          value &&
          !config.conversion.allowedFileTypes.includes(value.toLowerCase())
        ) {
          throw new Error(
            `Unsupported file type. Allowed types: ${config.conversion.allowedFileTypes.join(
              ', '
            )}`
          );
        }
        return true;
      }),
  ],

  url: [
    body('url')
      .notEmpty()
      .withMessage('URL is required')
      .isString()
      .withMessage('URL must be a string')
      .custom((value) => {
        // Normalize the URL
        const normalizedUrl = normalizeUrl(value);
        try {
          new URL(normalizedUrl);
          return true;
        } catch (error) {
          throw new Error('Invalid URL format');
        }
      }),
  ],

  parenturl: [
    body('parenturl')
      .notEmpty()
      .withMessage('Parent URL is required')
      .isString()
      .withMessage('Parent URL must be a string')
      .custom((value) => {
        // Normalize the URL
        const normalizedUrl = normalizeUrl(value);
        try {
          new URL(normalizedUrl);
          return true;
        } catch (error) {
          throw new Error('Invalid Parent URL format');
        }
      }),
  ],

  youtube: [
    body('url')
      .notEmpty()
      .withMessage('YouTube URL is required')
      .isString()
      .withMessage('YouTube URL must be a string')
      .custom((value) => {
        // Normalize the URL
        const normalizedUrl = normalizeUrl(value);
        const regex = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.be)\/.+$/;
        if (!regex.test(normalizedUrl)) {
          throw new Error('URL must be a valid YouTube link');
        }
        return true;
      }),
  ],

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
    body('items.*.content').notEmpty().withMessage('Each item must have content'),
    body('items.*.name').notEmpty().withMessage('Each item must have a name'),
  ],

  checkResult: (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400, errors.array()));
    }
    next();
  },
};
