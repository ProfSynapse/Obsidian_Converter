// src/lib/api/client.js

import { CONFIG } from '../config';
import { ConversionError, ErrorUtils } from './errors.js';
import { Converters } from './converters.js';
import { conversionStatus } from '../stores/conversionStatus.js';
import { FileStatus } from '../stores/files.js';
import { ENDPOINTS, getEndpointUrl } from './endpoints.js';
import { makeRequest } from './requestHandler.js';

/**
 * Manages file conversion operations and tracks their status
 */
class ConversionClient {
  constructor(baseUrl = CONFIG.API.BASE_URL) {
    this.activeRequests = new Map();
    this.config = CONFIG;
    this.baseUrl = baseUrl;
    this.isRailway = import.meta.env.PROD;
    this.supportedTypes = ['file', 'url', 'parent', 'youtube', 'audio', 'video'];
  }

  /**
   * Normalizes a URL to ensure consistent format
   * @private
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
      const determinedType = this.getItemType(item);
      
      // Validate file size
      if (item.file.size > this.config.CONVERSION.FILE_SIZE_LIMIT) {
        throw ConversionError.validation(
          `File size exceeds limit of ${this.config.CONVERSION.FILE_SIZE_LIMIT / (1024 * 1024)}MB`
        );
      }

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

  isSupportedFileType(extension) {
    if (!extension) return false;
    const categories = this.config.FILES.CATEGORIES;
    return (
      categories.documents.includes(extension) ||
      categories.audio.includes(extension) ||
      categories.video.includes(extension) ||
      categories.data.includes(extension)
    );
  }

  /**
   * Generates a unique ID for items
   * @private
   */
  _generateId() {
    try {
      return crypto.randomUUID();
    } catch (e) {
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Makes a request to the API
   * @private
   */
  async makeRequest(endpoint, options) {
    const fullEndpoint = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    return makeRequest(fullEndpoint, options);
  }

  /**
   * Process multiple items for conversion
   * @public
   */
  async processItems(items, apiKey, options = {}) {
    if (!items?.length) {
      throw new ConversionError('No items provided for processing');
    }

    const { useBatch = false, onProgress, onItemComplete } = options;

    try {
      // Import socket service
      const socketService = (await import('../services/socket.js')).default;
      
      // Ensure socket is connected
      if (!socketService.connected) {
        socketService.connect();
      }

      if (useBatch) {
        return this.processBatch(items, apiKey, { onProgress, onItemComplete });
      }

      const results = await Promise.all(items.map(async (item) => {
        try {
          const endpoint = this.getDefaultEndpoint(item);
          let requestData;

          // Prepare request data based on item type
          if (item.type === 'url' || item.type === 'youtube') {
            requestData = {
              url: item.url || item.content,
              name: item.name || 'url-conversion',
              options: item.options || {},
              type: item.type
            };
          } else if (item.type === 'parent') {
            requestData = {
              parenturl: item.url || item.content,
              options: {
                includeImages: true,
                includeMeta: true,
                maxDepth: item.options?.maxDepth || 3,
                maxPages: item.options?.maxPages || 100,
                ...item.options
              }
            };
          } else if (item.file instanceof File) {
            if (!item.file) {
              throw new ConversionError('File data is missing');
            }

            if (item.file.size > this.config.CONVERSION.FILE_SIZE_LIMIT) {
              throw new ConversionError(
                `File size exceeds limit of ${this.config.CONVERSION.FILE_SIZE_LIMIT / (1024 * 1024)}MB`,
                'VALIDATION_ERROR'
              );
            }

            const formData = new FormData();
            formData.append('file', item.file);
            formData.append('options', JSON.stringify({
              ...item.options,
              filename: item.file.name,
              fileType: item.file.type
            }));
            requestData = formData;
          } else {
            throw new ConversionError('Invalid item format - must provide either a URL or file');
          }

          // Make initial request to get job ID
          const response = await this.makeRequest(endpoint, {
            method: 'POST',
            headers: {
              ...(!(requestData instanceof FormData) && { 'Content-Type': 'application/json' }),
              'Accept': 'application/json',
              ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
            },
            body: requestData instanceof FormData ? requestData : JSON.stringify(requestData)
          });

          // Log the full response for debugging
          console.log('📦 Server response:', JSON.stringify(response, null, 2));
          
          // Extract job ID from response
          const jobId = response.jobId || response.id || response.job?.id;
          if (!jobId) {
            console.error('❌ No job ID found in response:', response);
            throw new ConversionError('No job ID received from server', 'MISSING_JOB_ID', { response });
          }
          
          console.log('✅ Job ID extracted:', jobId);

          // Update item with job ID
          item.jobId = jobId;

          // Subscribe to job updates
          socketService.subscribeToJob(jobId, {
            onStatus: (data) => {
              console.log(`🔄 Job ${jobId} status:`, data);
            },
            onProgress: (data) => {
              console.log(`📈 Job ${jobId} progress:`, data);
              onProgress?.(data.progress);
            },
            onComplete: (data) => {
              console.log(`✅ Job ${jobId} complete:`, data);
              onItemComplete?.(item.id, true);
            },
            onError: (error) => {
              console.error(`❌ Job ${jobId} error:`, error);
              onItemComplete?.(item.id, false, error);
            }
          });

          return { jobId, item };
        } catch (error) {
          onItemComplete?.(item.id, false, error);
          throw error;
        }
      }));

      return results;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error instanceof ConversionError ? error : new ConversionError(error.message);
    }
  }
  
  getDefaultEndpoint(item) {
    const type = this.getItemType(item);
    
    const endpointMap = {
      audio: ENDPOINTS.CONVERT_AUDIO,
      video: ENDPOINTS.CONVERT_VIDEO,
      url: ENDPOINTS.CONVERT_URL,
      parent: ENDPOINTS.CONVERT_PARENT_URL,
      youtube: ENDPOINTS.CONVERT_YOUTUBE,
      file: ENDPOINTS.CONVERT_FILE
    };
    
    return endpointMap[type] || ENDPOINTS.CONVERT_FILE;
  }

  getItemType(item) {
    if (!item) return 'file';
    
    const fileType = item.file?.name.split('.').pop().toLowerCase();
    if (item.type === 'audio' || this.isAudioType(fileType)) return 'audio';
    if (item.type === 'video' || this.isVideoType(fileType)) return 'video';
    if (item.type === 'url') return 'url';
    if (item.type === 'parent') return 'parent';
    if (item.type === 'youtube') return 'youtube';
    
    // Check if it's a supported document type
    if (this.config.FILES.CATEGORIES.documents.includes(fileType)) {
      return 'file';
    }
    
    throw new ConversionError(
      `Unsupported file type: ${fileType}`,
      'VALIDATION_ERROR'
    );
  }

  isAudioType(ext) {
    return ext && this.config.FILES.CATEGORIES.audio.includes(ext);
  }

  isVideoType(ext) {
    return ext && this.config.FILES.CATEGORIES.video.includes(ext);
  }

  async _getErrorMessage(response) {
    try {
      const data = await response.json();
      switch (response.status) {
        case 400:
          return data.message || 'Invalid file or upload interrupted';
        case 404:
          return 'Invalid API endpoint';
        case 413:
          return 'File size exceeds maximum limit of 50MB';
        case 500:
          return 'Server error during file processing';
        default:
          return data.message || 'Unknown error occurred';
      }
    } catch {
      return 'Error processing server response';
    }
  }

  cancelRequests() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }
}

export default new ConversionClient();
export { ConversionError, ErrorUtils };
