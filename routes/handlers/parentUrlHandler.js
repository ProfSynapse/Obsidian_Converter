// routes/convert/handlers/parentUrlHandler.js

import { createBatchZip, handleConversion } from '../utils/zipProcessor.js';
import { AppError } from '../../utils/errorHandler.js';
import sanitizeFilename from 'sanitize-filename';

/**
 * Parent URL conversion handler
 */
export async function handleParentUrlConversion(req, res, next) {
  try {
    const { parenturl } = req.body;
    console.log('Converting Parent URL:', parenturl);

    const urlString =
      typeof parenturl === 'object' ? parenturl.url || parenturl.parenturl : parenturl;
    const hostname = new URL(urlString).hostname;
    const conversionResult = await handleConversion(
      'parenturl',
      urlString,
      hostname,
      req.headers['x-api-key']
    );

    const zipBuffer = await createBatchZip([conversionResult]);

    // Set proper headers for ZIP file download
    const zipFilename = `${sanitizeFilename(hostname)}_archive_${new Date()
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
    console.error(`Parent URL conversion error: ${error.message}`);
    next(new AppError(`Parent URL conversion failed: ${error.message}`, 500));
  }
}
