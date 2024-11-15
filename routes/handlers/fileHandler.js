// routes/convert/handlers/fileHandler.js

import { createBatchZip, handleConversion } from '../utils/zipProcessor.js';
import { AppError } from '../../utils/errorHandler.js';
import sanitizeFilename from 'sanitize-filename';
import path from 'path';

/**
 * File upload handler
 */
export async function handleFileUpload(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }
    const fileExtension = path.extname(req.file.originalname).substring(1).toLowerCase();
    const conversionResult = await handleConversion(
      fileExtension,
      req.file.buffer,
      req.file.originalname,
      req.headers['x-api-key']
    );
    const zipBuffer = await createBatchZip([conversionResult]);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename=${sanitizeFilename(
        req.file.originalname
      )}_converted.zip`,
    });
    res.send(zipBuffer);
  } catch (error) {
    console.error(`File conversion error: ${error.message}`);
    next(new AppError(`File conversion failed: ${error.message}`, 500));
  }
}
