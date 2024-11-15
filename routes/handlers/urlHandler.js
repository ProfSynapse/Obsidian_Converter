// routes/handlers/urlHandler.js

import { createBatchZip, handleConversion } from '../utils/zipProcessor.js';
import { AppError } from '../../utils/errorHandler.js';
import sanitizeFilename from 'sanitize-filename';

// Types (can be moved to separate types file)
/**
 * @typedef {Object} ConversionOptions
 * @property {boolean} includeImages - Whether to include images
 * @property {boolean} includeMeta - Whether to include metadata
 * @property {boolean} convertLinks - Whether to convert links
 * @property {number} maxDepth - Maximum depth for nested conversions
 */

/**
 * @typedef {Object} ConversionResult
 * @property {boolean} success - Whether the conversion was successful
 * @property {Buffer} buffer - The ZIP buffer
 * @property {string} filename - The filename for the ZIP
 * @property {string} [error] - Error message if conversion failed
 */

// Constants
const CONSTANTS = {
  CONVERSION: {
    includeImages: true,
    includeMeta: true,
    convertLinks: true,
    maxDepth: 1
  },
  FILENAMES: {
    maxLength: 100,
    defaultPrefix: 'page',
  },
  HEADERS: {
    contentType: 'application/zip',
    cache: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  },
  REQUEST_TIMEOUT: 300000 // 5 minutes
};

// Request tracking using WeakMap to avoid memory leaks
const activeRequests = new WeakMap();

/**
 * URL Handler Utilities
 */
class UrlHandler {
  /**
   * Creates a sanitized filename for the ZIP
   */
  static createFilename(hostname, prefix = CONSTANTS.FILENAMES.defaultPrefix) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `${prefix}_${hostname}_${timestamp}`;

    return sanitizeFilename(baseFilename)
      .substring(0, CONSTANTS.FILENAMES.maxLength) + '.zip';
  }

  /**
   * Validates and extracts domain information from URL
   */
  static validateUrl(url) {
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
   * Sets download headers for response
   */
  static setDownloadHeaders(res, filename) {
    res.set({
      'Content-Type': CONSTANTS.HEADERS.contentType,
      'Content-Disposition': `attachment; filename="${sanitizeFilename(filename)}"`,
      ...CONSTANTS.HEADERS.cache
    });
  }

  /**
   * Tracks active request
   */
  static trackRequest(req, id) {
    const requestInfo = {
      id,
      startTime: Date.now(),
      timeout: setTimeout(() => {
        this.cleanupRequest(req);
      }, CONSTANTS.REQUEST_TIMEOUT)
    };
    activeRequests.set(req, requestInfo);
    return requestInfo;
  }

  /**
   * Cleans up request tracking
   */
  static cleanupRequest(req) {
    const requestInfo = activeRequests.get(req);
    if (requestInfo?.timeout) {
      clearTimeout(requestInfo.timeout);
    }
    activeRequests.delete(req);
    console.log(`Request ${requestInfo.id} cleaned up.`);
  }
}

/**
 * Main URL conversion handler
 */
export async function handleUrlConversion(req, res, next) {
  const requestId = Math.random().toString(36).substring(7);

  // Check if request is already being processed
  if (activeRequests.has(req)) {
    console.warn(`Request ${requestId} is already in progress.`);
    return next(new AppError('Request already in progress', 429));
  }

  // Start request tracking
  UrlHandler.trackRequest(req, requestId);
  console.log(`[${requestId}] Started processing URL conversion.`);

  try {
    const { url, options = {} } = req.body;
    const apiKey = req.headers['x-api-key'];

    console.log(`[${requestId}] Processing URL: ${url}`);

    // Validate URL and get domain info
    const { hostname } = UrlHandler.validateUrl(url);
    console.log(`[${requestId}] Validated URL. Hostname: ${hostname}`);

    // Merge options with defaults
    const conversionOptions = {
      ...CONSTANTS.CONVERSION,
      ...options
    };
    console.log(`[${requestId}] Conversion options:`, conversionOptions);

    // Handle conversion
    const conversionResult = await handleConversion('url', url, hostname, apiKey);
    console.log(`[${requestId}] Conversion result:`, conversionResult);

    // Create ZIP archive
    const zipBuffer = await createBatchZip([conversionResult]);
    console.log(`[${requestId}] Created ZIP buffer, size: ${zipBuffer.length} bytes`);

    // Create filename
    const filename = UrlHandler.createFilename(hostname);
    console.log(`[${requestId}] Generated filename: ${filename}`);

    // Set headers and send response
    UrlHandler.setDownloadHeaders(res, filename);
    console.log(`[${requestId}] Set download headers. Sending ZIP file.`);
    return res.send(zipBuffer);

  } catch (error) {
    console.error(`[${requestId}] Error during URL conversion:`, error);
    return next(new AppError(
      error.message || 'URL conversion failed',
      error.status || 500,
      { requestId }
    ));
  } finally {
    UrlHandler.cleanupRequest(req);
    console.log(`[${requestId}] Finished processing URL conversion.`);
  }
}

/**
 * URL conversion middleware
 */
export function urlConversionMiddleware(options = {}) {
  return (req, res, next) => {
    // Add request metadata
    Object.assign(req, {
      id: Math.random().toString(36).substring(7),
      startTime: Date.now(),
      conversionOptions: {
        ...CONSTANTS.CONVERSION,
        ...options
      }
    });

    next();
  };
}

export const utils = UrlHandler;
export { CONSTANTS };
