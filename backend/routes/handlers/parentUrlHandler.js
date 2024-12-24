// routes/handlers/parentUrlHandler.js

import { createBatchZip } from '../utils/zipProcessor.js';
import { AppError } from '../../utils/errorHandler.js';
import { convertParentUrlToMarkdown } from '../../services/converter/web/parentUrlConverter.js';
import sanitizeFilename from 'sanitize-filename';

/**
 * Parent URL conversion handler
 */
export async function handleParentUrlConversion(req, res, next) {
    try {
        console.log('Parent URL conversion request:', req.body);
        
        // Extract URL from request
        const { parenturl } = req.body;
        if (!parenturl) {
            throw new AppError('Parent URL is required', 400);
        }

        // Convert URL string or object to string
        const urlString = typeof parenturl === 'object' ? 
            parenturl.url || parenturl.parenturl : 
            parenturl;

        console.log('Converting Parent URL:', urlString);

        // Validate and sanitize the URL
        const normalizedUrl = normalizeUrl(urlString);

        // Convert parent URL and its children
        const result = await convertParentUrlToMarkdown(normalizedUrl);
        
        // Create ZIP with all content
        const zipBuffer = await createBatchZip([result]);

        // Generate filename for the ZIP
        const zipFilename = `${sanitizeFilename(new URL(normalizedUrl).hostname)}_archive_${
            new Date().toISOString().replace(/[:.]/g, '-')
        }.zip`;

        // Send response
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename=${zipFilename}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        return res.send(zipBuffer);

    } catch (error) {
        console.error('Parent URL conversion error:', error);
        next(new AppError(`Parent URL conversion failed: ${error.message}`, error.status || 500));
    }
}

/**
 * Validates and normalizes a URL
 * @param {string} url - URL to validate
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
    try {
        url = url.trim();
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url.replace(/^\/\//, '');
        }

        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            throw new Error(`Invalid protocol: ${urlObj.protocol}`);
        }

        return urlObj.href;
    } catch (error) {
        throw new AppError(`Invalid URL: ${error.message}`, 400);
    }
}
