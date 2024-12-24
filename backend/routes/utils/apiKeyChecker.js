// routes/convert/utils/apiKeyChecker.js

import { requiresApiKey } from './categoryDetector.js';
import { AppError } from '../../utils/errorHandler.js';
import path from 'path';

/**
 * Middleware to check API key based on file type
 */
export function apiKeyChecker(req, res, next) {
  // Determine fileType based on request
  let fileType = null;

  if (req.fileType) {
    fileType = req.fileType;
  } else if (req.body.fileType) {
    fileType = req.body.fileType;
  } else if (req.file && req.file.originalname) {
    fileType = path.extname(req.file.originalname).slice(1);
  }

  if (!requiresApiKey(fileType)) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return next(new AppError('API key is required for audio/video conversion', 401));
  }

  if (!apiKey.startsWith('sk-')) {
    return next(new AppError('Invalid API key format', 401));
  }

  next();
}
