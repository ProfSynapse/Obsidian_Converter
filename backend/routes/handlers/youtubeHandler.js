// routes/handlers/youtubeHandler.js
import JSZip from 'jszip';
import sanitizeFilename from 'sanitize-filename';
import { convertYoutubeToMarkdown } from '../../services/converter/web/youtubeConverter.js';
import { AppError } from '../../utils/errorHandler.js';
import { extractVideoId } from '../utils/youtubeUtils.js';

/**
 * Main YouTube conversion handler
 * @param {Object} req - The HTTP request object
 * @param {Object} res - The HTTP response object
 * @param {Function} next - The next middleware function
 */
export async function handleYouTubeConversion(req, res, next) {
  try {
    const { url } = req.body;
    const apiKey = req.headers['x-api-key']; // If needed
    const videoId = extractVideoId(url);

    if (videoId === 'unknown') {
      throw new Error('Invalid YouTube URL');
    }

    // Get the conversion result which includes metadata
    const result = await convertYoutubeToMarkdown(url, apiKey);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Create ZIP with the proper filename using metadata
    const zip = new JSZip();
    const safeTitle = sanitizeFilename(result.name || `${videoId}`);
    const safeFilename = `${safeTitle}.md`;

    zip.file(safeFilename, result.content);
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Use the video title in the ZIP filename
    const zipFilename = `youtube_${safeTitle}_${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.zip`;

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename=${zipFilename}`,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    return res.send(zipBuffer);
  } catch (error) {
    console.error(`YouTube conversion error: ${error.message}`);
    next(new AppError(`YouTube conversion failed: ${error.message}`, 500));
  }
}
