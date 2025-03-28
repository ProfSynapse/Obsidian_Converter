/**
 * URL Conversion Module
 * 
 * Handles conversion of URLs to Markdown format, including both single pages
 * and parent URLs (entire websites). Uses the Electron IPC bridge for communication
 * with the main process.
 * 
 * Related files:
 * - ../eventHandlers.js: Event registration and handling
 * - ../utils.js: Utility functions
 * - ../client.js: Core client functionality
 */

import { ConversionError } from '../../errors.js';
import { normalizeUrl } from '../utils.js';
import { conversionStatus } from '../../../stores/conversionStatus.js';
import eventHandlerManager from '../eventHandlers.js';
import { generateId } from '../utils.js';

/**
 * Converts a single URL to Markdown
 * @param {string} url The URL to convert
 * @param {Object} options Conversion options
 * @param {Function} onProgress Progress callback
 * @returns {Promise<Object>} Conversion result
 */
export async function convertUrl(url, options = {}, onProgress = null) {
  if (!window.electronAPI) {
    throw new ConversionError('Cannot convert URL: Not running in Electron environment');
  }

  try {
    // Normalize URL
    const normalizedUrl = normalizeUrl(url);

    // Set initial status
    conversionStatus.setStatus('initializing');
    conversionStatus.setProgress(0);
    conversionStatus.setCurrentFile(normalizedUrl);
    conversionStatus.setError(null);

    // Generate a job ID
    const jobId = generateId();

    // Register event handlers
    eventHandlerManager.registerHandlers(jobId, normalizedUrl, onProgress);

    // Prepare request data
    const requestData = {
      url: normalizedUrl,
      options: {
        includeImages: true,
        includeMeta: true,
        ...options
      }
    };

    // Call the IPC method
    const result = await window.electronAPI.convertUrl(normalizedUrl, requestData.options);

    // Check for errors
    if (!result.success) {
      throw new ConversionError(result.error || 'URL conversion failed');
    }

    return result;
  } catch (error) {
    // Update status
    conversionStatus.setStatus('error');
    conversionStatus.setError(error.message || 'Unknown error occurred');
    conversionStatus.setProgress(0);

    throw error instanceof ConversionError ? 
      error : 
      new ConversionError(error.message || 'URL conversion failed');
  }
}

/**
 * Converts a parent URL (website) to Markdown
 * @param {string} url The parent URL to convert
 * @param {Object} options Conversion options
 * @param {Function} onProgress Progress callback
 * @returns {Promise<Object>} Conversion result
 */
export async function convertParentUrl(url, options = {}, onProgress = null) {
  if (!window.electronAPI) {
    throw new ConversionError('Cannot convert parent URL: Not running in Electron environment');
  }

  try {
    // Normalize URL
    const normalizedUrl = normalizeUrl(url);

    // Set initial status
    conversionStatus.setStatus('initializing');
    conversionStatus.setProgress(0);
    conversionStatus.setCurrentFile(`Website: ${normalizedUrl}`);
    conversionStatus.setError(null);

    // Generate a job ID
    const jobId = generateId();

    // Register event handlers
    eventHandlerManager.registerHandlers(jobId, normalizedUrl, onProgress);

    // Prepare request data
    const requestData = {
      url: normalizedUrl,
      options: {
        includeImages: true,
        includeMeta: true,
        depth: options.depth || 1,
        maxPages: options.maxPages || 10,
        ...options
      }
    };

    // Call the IPC method
    const result = await window.electronAPI.convertParentUrl(normalizedUrl, requestData.options);

    // Check for errors
    if (!result.success) {
      throw new ConversionError(result.error || 'Parent URL conversion failed');
    }

    return result;
  } catch (error) {
    // Update status
    conversionStatus.setStatus('error');
    conversionStatus.setError(error.message || 'Unknown error occurred');
    conversionStatus.setProgress(0);

    throw error instanceof ConversionError ? 
      error : 
      new ConversionError(error.message || 'Parent URL conversion failed');
  }
}

/**
 * Converts a YouTube URL to Markdown
 * @param {string} url The YouTube URL to convert
 * @param {Object} options Conversion options
 * @param {Function} onProgress Progress callback
 * @returns {Promise<Object>} Conversion result
 */
export async function convertYoutube(url, options = {}, onProgress = null) {
  if (!window.electronAPI) {
    throw new ConversionError('Cannot convert YouTube URL: Not running in Electron environment');
  }

  try {
    // Normalize URL
    const normalizedUrl = normalizeUrl(url);

    // Set initial status
    conversionStatus.setStatus('initializing');
    conversionStatus.setProgress(0);
    conversionStatus.setCurrentFile(`YouTube: ${normalizedUrl}`);
    conversionStatus.setError(null);

    // Generate a job ID
    const jobId = generateId();

    // Register event handlers
    eventHandlerManager.registerHandlers(jobId, normalizedUrl, onProgress);

    // Prepare request data
    const requestData = {
      url: normalizedUrl,
      options: {
        includeImages: true,
        includeMeta: true,
        ...options
      }
    };

    // Call the IPC method
    const result = await window.electronAPI.convertYoutube(normalizedUrl, requestData.options);

    // Check for errors
    if (!result.success) {
      throw new ConversionError(result.error || 'YouTube conversion failed');
    }

    return result;
  } catch (error) {
    // Update status
    conversionStatus.setStatus('error');
    conversionStatus.setError(error.message || 'Unknown error occurred');
    conversionStatus.setProgress(0);

    throw error instanceof ConversionError ? 
      error : 
      new ConversionError(error.message || 'YouTube conversion failed');
  }
}
