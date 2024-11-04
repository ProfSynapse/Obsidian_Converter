// routes/convert/handlers/urlHandler.js

import { createBatchZip, handleConversion } from '../utils/zipProcessor.js';
import { AppError } from '../../utils/errorHandler.js';
import sanitizeFilename from 'sanitize-filename';

/**
 * URL conversion handler
 */
export async function handleUrlConversion(req, res, next) {
  try {
    const { url } = req.body;
    console.log('Converting URL:', url);

    const hostname = new URL(url).hostname;
    const conversionResult = await handleConversion(
      'url',
      url,
      hostname,
      req.headers['x-api-key']
    );

    const zipBuffer = await createBatchZip([conversionResult]);

    // Set proper headers for ZIP file download
    const zipFilename = `${sanitizeFilename(hostname)}_page_${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.zip`;

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename=${sanitizeFilename(zipFilename)}`,
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      Expires: '0',
    });

    return res.send(zipBuffer);
  } catch (error) {
    console.error(`URL conversion error: ${error.message}`);
    next(new AppError(`URL conversion failed: ${error.message}`, 500));
  }
}
