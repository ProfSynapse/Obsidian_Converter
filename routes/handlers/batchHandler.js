// routes/convert/handlers/batchHandler.js

import { createBatchZip, handleConversion } from '../utils/zipProcessor.js';
import { AppError } from '../../utils/errorHandler.js';
import sanitizeFilename from 'sanitize-filename';

/**
 * Batch conversion handler
 */
export async function handleBatchConversion(req, res, next) {
  try {
    const { items } = req.body;
    const apiKey = req.headers['x-api-key'];

    if (!Array.isArray(items)) {
      throw new AppError('Items must be an array', 400);
    }

    // Validate each item has 'type', 'content', and 'name'
    for (const item of items) {
      if (!item.type || typeof item.type !== 'string') {
        throw new AppError(`Item "${item.name || 'unknown'}" is missing a valid 'type' property`, 400);
      }
      if (!item.content) {
        throw new AppError(`Item "${item.name || 'unknown'}" is missing 'content' property`, 400);
      }
      if (!item.name || typeof item.name !== 'string') {
        throw new AppError(`Item is missing a valid 'name' property`, 400);
      }
    }

    // Process all items concurrently
    const results = await Promise.all(
      items.map(async (item) => {
        const type = item.type.toLowerCase();
        const content = item.content;
        const name = item.name;

        return await handleConversion(type, content, name, apiKey);
      })
    );

    // Create and send ZIP
    const zipBuffer = await createBatchZip(results);

    // Determine ZIP filename based on current date-time
    const zipFilename = `conversion_${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.zip`;

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename=${sanitizeFilename(zipFilename)}`,
    });
    res.send(zipBuffer);
  } catch (error) {
    console.error(`Batch conversion handler error: ${error.message}`);
    next(new AppError(error.message, 500));
  }
}
