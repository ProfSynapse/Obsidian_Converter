/**
 * Electron IPC API Client
 * 
 * This client provides an interface for communicating with the Electron main process
 * via IPC channels. It replaces the HTTP-based API client for desktop operations.
 * 
 * Related files:
 * - client.js: Original HTTP-based client (being replaced)
 * - offlineApi.js: Offline-aware API wrapper
 * - src/electron/preload.js: Exposes IPC channels to renderer
 * - src/electron/ipc/handlers.js: Main process IPC handlers
 */

import { ConversionError, ErrorUtils } from './errors.js';
import { conversionStatus } from '../stores/conversionStatus.js';
import { FileStatus } from '../stores/files.js';

/**
 * Manages file conversion operations through Electron IPC
 */
class ElectronClient {
  constructor() {
    // Check if we're in a browser environment first
    const isBrowser = typeof window !== 'undefined';
    
    // Then check if we're in an Electron environment
    this.isElectron = isBrowser && window.electronAPI !== undefined;
    
    if (isBrowser && !this.isElectron) {
      console.warn('ElectronClient: Not running in Electron environment');
    }
    
    this.activeRequests = new Map();
    this.supportedTypes = ['file', 'url', 'parent', 'youtube', 'audio', 'video'];
  }

  /**
   * Checks if the client is running in Electron
   * @returns {boolean} Whether the client is running in Electron
   */
  isRunningInElectron() {
    return this.isElectron;
  }

  /**
   * Normalizes a URL to ensure consistent format
   * @private
   * @param {string} url The URL to normalize
   * @returns {string} The normalized URL
   */
  _normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      const normalizedPath = urlObj.pathname.replace(/\/+$/, '').toLowerCase();
      urlObj.pathname = normalizedPath;
      return urlObj.href.toLowerCase();
    } catch (error) {
      console.error('URL normalization error:', error);
      return url.toLowerCase();
    }
  }

  /**
   * Validates and normalizes an item for conversion
   * @private
   * @param {Object} item The item to validate and normalize
   * @returns {Object} The normalized item
   */
  _validateAndNormalizeItem(item) {
    if (!item?.type) {
      throw ConversionError.validation('Invalid item: missing type');
    }
  
    const type = item.type.toLowerCase();
  
    if (!this.supportedTypes.includes(type)) {
      throw ConversionError.validation(`Unsupported type: ${type}`);
    }

    // Special validation for parent URL
    if (type === 'parent' && !item.url) {
      throw ConversionError.validation('Parent URL is required');
    }

    // Normalize URLs if present
    const normalizedUrl = item.url ? this._normalizeUrl(item.url) : null;
    const normalizedContent = item.content && typeof item.content === 'string' ? 
      this._normalizeUrl(item.content) : item.content;

    // File validation for audio/video/document types
    if (item.file instanceof File) {
      const fileType = item.file.name.split('.').pop().toLowerCase();
      
      // Validate file type
      if (!this.isSupportedFileType(fileType)) {
        throw ConversionError.validation(`Unsupported file type: ${fileType}`);
      }
    }

    // Normalize the item's properties
    return {
      id: item.id || this._generateId(),
      type,
      name: item.name?.trim() || 'Untitled',
      url: normalizedUrl,
      content: normalizedContent,
      file: item.file,  // Preserve the file object
      options: {
        includeImages: true,
        includeMeta: true,
        convertLinks: true,
        ...(type === 'parent' && {
          depth: item.options?.depth || 1,
          maxPages: item.options?.maxPages || 10
        }),
        ...item.options
      }
    };
  }

  /**
   * Checks if a file type is supported
   * @param {string} extension The file extension to check
   * @returns {boolean} Whether the file type is supported
   */
  isSupportedFileType(extension) {
    if (!extension) return false;
    
    // Get supported file types from config
    const supportedDocuments = ['pdf', 'docx', 'pptx', 'txt', 'rtf', 'md'];
    const supportedAudio = ['mp3', 'wav', 'm4a', 'flac', 'ogg'];
    const supportedVideo = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
    const supportedData = ['csv', 'xlsx', 'json', 'yaml', 'yml'];
    
    return (
      supportedDocuments.includes(extension) ||
      supportedAudio.includes(extension) ||
      supportedVideo.includes(extension) ||
      supportedData.includes(extension)
    );
  }

  /**
   * Generates a unique ID for items
   * @private
   * @returns {string} A unique ID
   */
  _generateId() {
    try {
      return crypto.randomUUID();
    } catch (e) {
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Gets the appropriate item type based on file extension or item type
   * @param {Object} item The item to get the type for
   * @returns {string} The item type
   */
  getItemType(item) {
    if (!item) return 'file';
    
    const fileType = item.file?.name.split('.').pop().toLowerCase();
    if (item.type === 'audio' || this.isAudioType(fileType)) return 'audio';
    if (item.type === 'video' || this.isVideoType(fileType)) return 'video';
    if (item.type === 'url') return 'url';
    if (item.type === 'parent') return 'parent';
    if (item.type === 'youtube') return 'youtube';
    
    // Default to file type
    return 'file';
  }

  /**
   * Checks if a file extension is an audio type
   * @param {string} ext The file extension
   * @returns {boolean} Whether the extension is an audio type
   */
  isAudioType(ext) {
    const audioTypes = ['mp3', 'wav', 'm4a', 'flac', 'ogg'];
    return ext && audioTypes.includes(ext);
  }

  /**
   * Checks if a file extension is a video type
   * @param {string} ext The file extension
   * @returns {boolean} Whether the extension is a video type
   */
  isVideoType(ext) {
    const videoTypes = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
    return ext && videoTypes.includes(ext);
  }

  /**
   * Processes a single file for conversion
   * @param {string} filePath Path to the file to convert
   * @param {Object} options Conversion options
   * @param {Function} onProgress Progress callback
   * @returns {Promise<Object>} Conversion result
   */
  async convertFile(filePath, options = {}, onProgress) {
    if (!this.isElectron) {
      throw new ConversionError('Cannot convert file: Not running in Electron environment');
    }

    try {
      // Update conversion status
      conversionStatus.update(status => ({
        ...status,
        active: true,
        progress: 0,
        currentFile: filePath.split('/').pop(),
        error: null
      }));

      // Set up event handlers
      const progressHandler = (event, data) => {
        if (data.file === filePath || (data.id && this.activeRequests.has(data.id))) {
          conversionStatus.update(status => ({
            ...status,
            progress: data.progress
          }));
          
          if (onProgress) {
            onProgress(data.progress);
          }
        }
      };
      
      const statusHandler = (event, data) => {
        if (this.activeRequests.has(data.id)) {
          conversionStatus.update(status => ({
            ...status,
            status: data.status
          }));
        }
      };
      
      const completeHandler = (event, data) => {
        if (this.activeRequests.has(data.id)) {
          // Update conversion status
          conversionStatus.update(status => ({
            ...status,
            active: false,
            progress: 100,
            currentFile: null,
            status: 'completed'
          }));
          
          // Clean up
          this._removeEventHandlers(data.id);
          this.activeRequests.delete(data.id);
        }
      };
      
      const errorHandler = (event, data) => {
        if (this.activeRequests.has(data.id)) {
          // Update conversion status with error
          conversionStatus.update(status => ({
            ...status,
            active: false,
            error: data.error || 'Unknown error occurred',
            status: 'error'
          }));
          
          // Clean up
          this._removeEventHandlers(data.id);
          this.activeRequests.delete(data.id);
        }
      };

      // Register event handlers
      window.electronAPI.onConversionProgress(progressHandler);
      window.electronAPI.onConversionStatus(statusHandler);
      window.electronAPI.onConversionComplete(completeHandler);
      window.electronAPI.onConversionError(errorHandler);

      // Call the IPC method
      const result = await window.electronAPI.convertFile(filePath, options);
      
      // Store job ID and event handlers for cleanup
      if (result.jobId) {
        this.activeRequests.set(result.jobId, {
          id: result.jobId,
          handlers: {
            progress: progressHandler,
            status: statusHandler,
            complete: completeHandler,
            error: errorHandler
          }
        });
      }

      return result;
    } catch (error) {
      // Update conversion status with error
      conversionStatus.update(status => ({
        ...status,
        active: false,
        error: error.message || 'Unknown error occurred',
        status: 'error'
      }));

      throw error instanceof ConversionError ? 
        error : 
        new ConversionError(error.message || 'File conversion failed');
    }
  }
  
  /**
   * Removes event handlers for a job
   * @private
   * @param {string} jobId The job ID
   */
  _removeEventHandlers(jobId) {
    if (this.activeRequests.has(jobId)) {
      const { handlers } = this.activeRequests.get(jobId);
      
      // Remove event listeners
      window.electronAPI.onConversionProgress(handlers.progress);
      window.electronAPI.onConversionStatus(handlers.status);
      window.electronAPI.onConversionComplete(handlers.complete);
      window.electronAPI.onConversionError(handlers.error);
    }
  }

  /**
   * Processes multiple files for conversion
   * @param {Array<string>} filePaths Paths to the files to convert
   * @param {Object} options Conversion options
   * @param {Function} onProgress Progress callback
   * @param {Function} onItemComplete Item completion callback
   * @returns {Promise<Array<Object>>} Conversion results
   */
  async convertBatch(filePaths, options = {}, onProgress, onItemComplete) {
    if (!this.isElectron) {
      throw new ConversionError('Cannot convert batch: Not running in Electron environment');
    }

    try {
      // Update conversion status
      conversionStatus.update(status => ({
        ...status,
        active: true,
        progress: 0,
        currentFile: 'Batch conversion',
        error: null
      }));

      // Call the IPC method
      const result = await window.electronAPI.convertBatch(filePaths, options);

      // Update conversion status
      conversionStatus.update(status => ({
        ...status,
        active: false,
        progress: 100,
        currentFile: null
      }));

      return result;
    } catch (error) {
      // Update conversion status with error
      conversionStatus.update(status => ({
        ...status,
        active: false,
        error: error.message || 'Unknown error occurred'
      }));

      throw error instanceof ConversionError ? 
        error : 
        new ConversionError(error.message || 'Batch conversion failed');
    }
  }

  /**
   * Opens a file selection dialog
   * @param {Object} options Dialog options
   * @returns {Promise<Array<string>>} Selected file paths
   */
  async selectFiles(options = {}) {
    if (!this.isElectron) {
      throw new ConversionError('Cannot select files: Not running in Electron environment');
    }

    try {
      return await window.electronAPI.selectFiles(options);
    } catch (error) {
      throw error instanceof ConversionError ? 
        error : 
        new ConversionError(error.message || 'File selection failed');
    }
  }

  /**
   * Opens an output directory selection dialog
   * @param {Object} options Dialog options
   * @returns {Promise<string>} Selected directory path
   */
  async selectOutputDirectory(options = {}) {
    if (!this.isElectron) {
      throw new ConversionError('Cannot select output directory: Not running in Electron environment');
    }

    try {
      return await window.electronAPI.selectOutput(options);
    } catch (error) {
      throw error instanceof ConversionError ? 
        error : 
        new ConversionError(error.message || 'Directory selection failed');
    }
  }
  
  /**
   * Opens an input directory selection dialog
   * @param {Object} options Dialog options
   * @returns {Promise<string>} Selected directory path
   */
  async selectInputDirectory(options = {}) {
    if (!this.isElectron) {
      throw new ConversionError('Cannot select input directory: Not running in Electron environment');
    }

    try {
      return await window.electronAPI.selectInputDirectory(options);
    } catch (error) {
      throw error instanceof ConversionError ? 
        error : 
        new ConversionError(error.message || 'Directory selection failed');
    }
  }
  
  /**
   * Lists directory contents with detailed information
   * @param {string} dirPath Directory path to list
   * @param {Object} options Listing options
   * @returns {Promise<{success: boolean, items?: Array<Object>, error?: string}>}
   */
  async listDirectory(dirPath, options = {}) {
    if (!this.isElectron) {
      throw new ConversionError('Cannot list directory: Not running in Electron environment');
    }

    try {
      return await window.electronAPI.listDirectoryDetailed(dirPath, options);
    } catch (error) {
      throw error instanceof ConversionError ? 
        error : 
        new ConversionError(error.message || 'Directory listing failed');
    }
  }

  /**
   * Gets the result of a conversion
   * @param {string} path Path to the converted file
   * @returns {Promise<Object>} Conversion result
   */
  async getResult(path) {
    if (!this.isElectron) {
      throw new ConversionError('Cannot get result: Not running in Electron environment');
    }

    try {
      return await window.electronAPI.getResult(path);
    } catch (error) {
      throw error instanceof ConversionError ? 
        error : 
        new ConversionError(error.message || 'Failed to get conversion result');
    }
  }

  /**
   * Converts a URL to Markdown
   * @param {string} url The URL to convert
   * @param {Object} options Conversion options
   * @param {Function} onProgress Progress callback
   * @returns {Promise<Object>} Conversion result
   */
  async convertUrl(url, options = {}, onProgress) {
    if (!this.isElectron) {
      throw new ConversionError('Cannot convert URL: Not running in Electron environment');
    }

    try {
      // Normalize URL
      const normalizedUrl = this._normalizeUrl(url);

      // Update conversion status
      conversionStatus.update(status => ({
        ...status,
        active: true,
        progress: 0,
        currentFile: normalizedUrl,
        error: null
      }));

      // Set up progress handler
      const progressHandler = (event, data) => {
        if (data.file === normalizedUrl) {
          conversionStatus.update(status => ({
            ...status,
            progress: data.progress
          }));
          
          if (onProgress) {
            onProgress(data.progress);
          }
        }
      };

      // Subscribe to progress events
      window.electronAPI.onConversionProgress(progressHandler);

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

      // Update conversion status
      conversionStatus.update(status => ({
        ...status,
        active: false,
        progress: 100,
        currentFile: null
      }));

      return result;
    } catch (error) {
      // Update conversion status with error
      conversionStatus.update(status => ({
        ...status,
        active: false,
        error: error.message || 'Unknown error occurred'
      }));

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
  async convertParentUrl(url, options = {}, onProgress) {
    if (!this.isElectron) {
      throw new ConversionError('Cannot convert parent URL: Not running in Electron environment');
    }

    try {
      // Normalize URL
      const normalizedUrl = this._normalizeUrl(url);

      // Update conversion status
      conversionStatus.update(status => ({
        ...status,
        active: true,
        progress: 0,
        currentFile: `Website: ${normalizedUrl}`,
        error: null
      }));

      // Set up progress handler
      const progressHandler = (event, data) => {
        if (data.file === normalizedUrl) {
          conversionStatus.update(status => ({
            ...status,
            progress: data.progress
          }));
          
          if (onProgress) {
            onProgress(data.progress);
          }
        }
      };

      // Subscribe to progress events
      window.electronAPI.onConversionProgress(progressHandler);

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

      // Update conversion status
      conversionStatus.update(status => ({
        ...status,
        active: false,
        progress: 100,
        currentFile: null
      }));

      return result;
    } catch (error) {
      // Update conversion status with error
      conversionStatus.update(status => ({
        ...status,
        active: false,
        error: error.message || 'Unknown error occurred'
      }));

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
  async convertYoutube(url, options = {}, onProgress) {
    if (!this.isElectron) {
      throw new ConversionError('Cannot convert YouTube URL: Not running in Electron environment');
    }

    try {
      // Normalize URL
      const normalizedUrl = this._normalizeUrl(url);

      // Update conversion status
      conversionStatus.update(status => ({
        ...status,
        active: true,
        progress: 0,
        currentFile: `YouTube: ${normalizedUrl}`,
        error: null
      }));

      // Set up progress handler
      const progressHandler = (event, data) => {
        if (data.file === normalizedUrl) {
          conversionStatus.update(status => ({
            ...status,
            progress: data.progress
          }));
          
          if (onProgress) {
            onProgress(data.progress);
          }
        }
      };

      // Subscribe to progress events
      window.electronAPI.onConversionProgress(progressHandler);

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

      // Update conversion status
      conversionStatus.update(status => ({
        ...status,
        active: false,
        progress: 100,
        currentFile: null
      }));

      return result;
    } catch (error) {
      // Update conversion status with error
      conversionStatus.update(status => ({
        ...status,
        active: false,
        error: error.message || 'Unknown error occurred'
      }));

      throw error instanceof ConversionError ? 
        error : 
        new ConversionError(error.message || 'YouTube conversion failed');
    }
  }

  /**
   * Cancels all active conversion requests
   */
  cancelRequests() {
    if (!this.isElectron) {
      return;
    }

    // Cancel all active requests
    this.activeRequests.forEach((request, id) => {
      window.electronAPI.cancelConversion(id);
      this._removeEventHandlers(id);
    });

    this.activeRequests.clear();

    // Update conversion status
    conversionStatus.update(status => ({
      ...status,
      active: false,
      progress: 0,
      currentFile: null,
      status: 'cancelled',
      error: 'Conversion cancelled'
    }));
  }
}

// Create and export singleton instance
const electronClient = new ElectronClient();
export default electronClient;
export { ConversionError, ErrorUtils };
