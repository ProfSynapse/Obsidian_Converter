// src/lib/api/client.js

import { CONFIG } from '../config';
import { ConversionError, ErrorUtils } from './errors.js';
import { Converters } from './converters.js';
import { conversionStatus } from '../stores/conversionStatus.js';
import { FileStatus } from '../stores/files.js';

/**
 * Manages file conversion operations and tracks their status
 */
class ConversionClient {
  constructor(baseUrl = CONFIG.API.BASE_URL) {
    this.activeRequests = new Map();
    this.config = CONFIG;
    this.baseUrl = baseUrl;
    // Get supported types from FILES.TYPES instead of ITEM_TYPES
    this.supportedTypes = Object.values(CONFIG.FILES.TYPES || {});
  }

  /**
 * Validates and normalizes item before conversion
 * @private
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
    if (type === CONFIG.ITEM_TYPES.PARENT_URL && !item.url) {
      throw ConversionError.validation('Parent URL is required');
    }

    // Normalize the item's properties
    return {
      id: item.id || crypto.randomUUID(),
      type,
      name: item.name?.trim() || 'Untitled',
      url: item.url?.trim() || null,
      content: item.content || null,
      options: {
        includeImages: true,
        includeMeta: true,
        convertLinks: true,
        ...(type === CONFIG.ITEM_TYPES.PARENT_URL && {
          depth: item.options?.depth || 1,
          maxPages: item.options?.maxPages || 10
        }),
        ...item.options
      }
    };
  }
  

  /**
   * Converts a single item
   * @public
   */
  async convertItem(item, apiKey) {
    try {
      const normalizedItem = this._validateAndNormalizeItem(item);

      // Log the normalized item for debugging
      console.log('Converting normalized item:', normalizedItem);

      // Validate required properties based on type
      if (normalizedItem.type === CONFIG.ITEM_TYPES.URL && !normalizedItem.url) {
        throw ConversionError.validation('URL is required for URL conversion');
      }

      let result;
      switch (normalizedItem.type) {
        case CONFIG.ITEM_TYPES.URL:
          result = await Converters.convertUrl(normalizedItem, apiKey);
          break;
        case CONFIG.ITEM_TYPES.YOUTUBE:
          // YouTube conversion no longer requires API key
          result = await Converters.convertYoutube(normalizedItem);
          break;
        case CONFIG.ITEM_TYPES.PARENT_URL:
          result = await Converters.convertParentUrl(normalizedItem, apiKey);
          break;
        case CONFIG.ITEM_TYPES.FILE:
          result = await Converters.convertFile(normalizedItem, apiKey);
          break;
        default:
          throw ConversionError.validation(`Unsupported conversion type: ${normalizedItem.type}`);
      }

      return result;

    } catch (error) {
      console.error(`Error converting item ${item?.name || 'unknown'}:`, error);
      throw ErrorUtils.wrap(error);
    }
  }

  /**
   * Processes multiple items sequentially
   * @private
   */
  async processItemsSequentially(items, apiKey, onProgress, onItemComplete) {
    const results = [];
    const totalItems = items.length;
    let completedItems = 0;

    for (const item of items) {
      try {
        // Update progress
        if (onProgress) {
          const progress = Math.round((completedItems / totalItems) * 100);
          onProgress(progress);
        }

        const result = await this.convertItem(item, apiKey);
        results.push({ success: true, result, item });

        if (onItemComplete) {
          onItemComplete(item.id, true);
        }

      } catch (error) {
        console.error(`Error processing item ${item.name}:`, error);
        results.push({ success: false, error: ErrorUtils.wrap(error), item });

        if (onItemComplete) {
          onItemComplete(item.id, false, error);
        }
      }

      completedItems++;
    }

    // Ensure we reach 100% progress
    if (onProgress) onProgress(100);

    return results;
  }

  /**
   * Process multiple items for conversion
   * @public
   */
  async processItems(items, apiKey, options = {}) {
    const {
      useBatch = false,
      getEndpoint,
      onProgress,
      onItemComplete
    } = options;

    try {
      // Only use batch processing for multiple items
      if (items.length > 1) {
        return this.processBatch(items, apiKey, options);
      }

      // Process single item
      const item = items[0];
      const endpoint = getEndpoint?.(item) || this.getDefaultEndpoint(item);
      
      console.log('Processing item:', { type: item.type, endpoint });
      
      const formData = new FormData();
      
      // Handle file uploads based on type
      if (item.file instanceof File) {
        formData.append('file', item.file);
        formData.append('name', item.file.name);
        formData.append('type', item.type);
      } else if (item.type === 'url') {
        formData.append('url', item.content);
      }

      if (item.options) {
        formData.append('options', JSON.stringify(item.options));
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: apiKey ? {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json, application/zip'
        } : {},
        body: formData
      });

      if (!response.ok) {
        throw new ConversionError(
          await response.text() || 'Conversion failed',
          response.status
        );
      }

      // Check content type for proper handling
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/zip') || contentType?.includes('application/octet-stream')) {
        const blob = await response.blob();
        // Get filename from Content-Disposition header or generate one
        const disposition = response.headers.get('content-disposition');
        const filename = disposition ? 
          disposition.split('filename=')[1].replace(/"/g, '') : 
          `obsidian_conversion_${new Date().getTime()}.zip`;

        // Trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        onItemComplete?.(item.id, true);
        return { success: true };
      }

      // Handle JSON response for other cases
      const result = await response.json();
      if (!result.success) {
        throw new ConversionError(result.error || 'Conversion failed');
      }

      return result;

    } catch (error) {
      console.error('API Error:', error);
      onItemComplete?.(items[0].id, false, error);
      throw error;
    }
  }

  async processBatch(items, apiKey, { onProgress, onItemComplete }) {
    console.log('[CLIENT] Processing batch:', items);

    const formData = new FormData();
    // Append each file as 'files[]' or each URL as a JSON item
    items.forEach((item, index) => {
      if (item.file) {
        formData.append('files', item.file, item.name);
      } else if (item.type === 'url') {
        // Keep JSON array for non-file items
        // Example: { type: 'url', url: item.content, name: item.name }
      }
    });

    // Add items in JSON if needed for the backend
    const nonFileItems = items.filter((i) => !i.file);
    if (nonFileItems.length) {
      formData.append('items', JSON.stringify(nonFileItems));
    }

    try {
      const response = await fetch(`${this.baseUrl}/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new ConversionError(err.message || 'Batch conversion failed', response.status);
      }

      // Track final progress
      onProgress?.(100);

      // Call onItemComplete for each item
      items.forEach(item => onItemComplete?.(item.id, true));
      return await response.blob();

    } catch (error) {
      console.error('[CLIENT] Batch error:', error);
      items.forEach(item => onItemComplete?.(item.id, false, error));
      throw error;
    }
  }

  getDefaultEndpoint(item) {
    const fileType = item.file?.name.split('.').pop().toLowerCase();
    
    // Determine endpoint based on file type and item type
    if (item.type === 'audio' || this.isAudioType(fileType)) {
      return '/multimedia/audio';
    }
    if (item.type === 'video' || this.isVideoType(fileType)) {
      return '/multimedia/video';
    }
    if (item.type === 'url') {
      return '/web/url';
    }
    if (item.type === 'parent') {
      return '/web/parent-url';
    }
    if (item.type === 'youtube') {
      return '/web/youtube';
    }
    
    return '/document/file';
  }

  isAudioType(ext) {
    return this.config.FILES.CATEGORIES.audio.includes(ext);
  }

  isVideoType(ext) {
    return this.config.FILES.CATEGORIES.video.includes(ext);
  }

  /**
   * Cancels all active conversion requests
   * @public
   */
  cancelAllRequests() {
    this.activeRequests.forEach((request, id) => {
      if (request.controller) {
        request.controller.abort();
        console.log(`Cancelled request: ${id}`);
      }
      this.activeRequests.delete(id);
    });

    conversionStatus.reset();
  }

  /**
   * Returns the count of active requests
   * @public
   */
  getActiveRequestsCount() {
    return this.activeRequests.size;
  }

  /**
   * Cleans up resources and resets state
   * @public
   */
  cleanup() {
    this.cancelAllRequests();
    this.activeRequests.clear();
    conversionStatus.reset();
  }

  /**
   * Makes a conversion request with enhanced error handling
   * @private
   */
  static async _makeConversionRequest(endpoint, options, type) {
    if (!endpoint) {
        throw new ConversionError(`No endpoint defined for ${type} conversion`, 'VALIDATION_ERROR');
    }
    
    try {
        console.log(`🔄 Making ${type} conversion request to ${endpoint}`);
        const response = await RequestHandler.makeRequest(endpoint, options);
        
        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }

        return await response.blob();
    } catch (error) {
        console.error(`❌ ${type} conversion error:`, error);
        throw ErrorUtils.wrap(error);
    }
  }
}

// Export singleton instance and related types
export default new ConversionClient();
export { ConversionError, ErrorUtils };
