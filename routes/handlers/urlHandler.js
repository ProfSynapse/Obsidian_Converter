// routes/handlers/urlHandler.js

import { createBatchZip, handleConversion } from '../utils/zipProcessor.js';
import { AppError } from '../../utils/errorHandler.js';
import sanitizeFilename from 'sanitize-filename';

/**
 * Constants for URL handling
 */
const CONSTANTS = {
    DEFAULT_OPTIONS: {
        includeImages: true,
        includeMeta: true,
        convertLinks: true,
        maxDepth: 1
    },
    MAX_FILENAME_LENGTH: 100,
    ZIP_CONTENT_TYPE: 'application/zip',
    CACHE_HEADERS: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    }
};

/**
 * Utility functions for URL handling
 */
class UrlHandlerUtils {
    /**
     * Creates a sanitized filename for the ZIP
     */
    static createZipFilename(hostname, prefix = 'page', suffix = '') {
        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, '-');
        
        const baseFilename = `${prefix}_${hostname}_${timestamp}${suffix}`;
        return sanitizeFilename(baseFilename)
            .substring(0, CONSTANTS.MAX_FILENAME_LENGTH) + '.zip';
    }

    /**
     * Extracts domain information from URL
     */
    static getDomainInfo(url) {
        try {
            const urlObj = new URL(url);
            return {
                hostname: urlObj.hostname,
                protocol: urlObj.protocol,
                pathname: urlObj.pathname,
                searchParams: urlObj.searchParams
            };
        } catch (error) {
            throw new AppError(`Invalid URL: ${error.message}`, 400);
        }
    }

    /**
     * Sets response headers for ZIP download
     */
    static setDownloadHeaders(res, filename) {
        res.set({
            'Content-Type': CONSTANTS.ZIP_CONTENT_TYPE,
            'Content-Disposition': `attachment; filename="${sanitizeFilename(filename)}"`,
            ...CONSTANTS.CACHE_HEADERS
        });
    }
}

/**
 * Main URL conversion handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
  export async function handleUrlConversion(req, res, next) {
    // Generate requestId at the start
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();

    if (req.inProgress) {
        console.log(`[${requestId}] Conversion already in progress, skipping`);
        return;
    }
    req.inProgress = true;

    try {
        const { url, options = {} } = req.body;
        const apiKey = req.headers['x-api-key'];

        console.log(`[${requestId}] Processing URL: ${url}`);

        const { hostname } = UrlHandlerUtils.getDomainInfo(url);
        const conversionOptions = {
            ...CONSTANTS.DEFAULT_OPTIONS,
            ...options
        };

        const conversionResult = await handleConversion(
            'url',
            url,
            hostname,
            apiKey,
            conversionOptions
        );

        if (!conversionResult.success) {
            throw new AppError(
                conversionResult.error || 'Conversion failed',
                conversionResult.status || 500,
                { requestId }
            );
        }

        const zipResult = await createZipArchive(conversionResult, hostname);
        
        if (!zipResult.success) {
            throw new AppError('Failed to create ZIP archive', 500, { requestId });
        }

        UrlHandlerUtils.setDownloadHeaders(res, zipResult.filename);
        
        return res.send(zipResult.buffer);

    } catch (error) {
        console.error(`[${requestId}] Error:`, error);
        next(new AppError(
            error.message || 'URL conversion failed',
            error.status || 500,
            { requestId }
        ));
    } finally {
        req.inProgress = false;
    }
  }

/**
 * Creates a ZIP archive from conversion result
 * @private
 */
async function createZipArchive(conversionResult, hostname) {
    try {
        const zipBuffer = await createBatchZip([conversionResult]);
        
        return {
            success: true,
            buffer: zipBuffer,
            filename: UrlHandlerUtils.createZipFilename(hostname)
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Middleware for handling URL conversion requests
 */
export function urlConversionMiddleware(options = {}) {
    return async (req, res, next) => {
        // Add request ID
        req.id = Math.random().toString(36).substring(7);
        
        // Add timing information
        req.startTime = Date.now();
        
        // Add options to request
        req.conversionOptions = {
            ...CONSTANTS.DEFAULT_OPTIONS,
            ...options
        };
        
        next();
    };
}

// Export utils for testing
export { UrlHandlerUtils, CONSTANTS };