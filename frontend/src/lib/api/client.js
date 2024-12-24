// src/lib/api/client.js

import { CONFIG } from './config.js';
import { ConversionError, ErrorUtils } from './errors.js';
import { Converters } from './converters.js';
import { conversionStatus } from '../stores/conversionStatus.js';
import { FileStatus } from '../stores/files.js';

/**
 * Manages file conversion operations and tracks their status
 */
class ConversionClient {
  constructor() {
    this.activeRequests = new Map();
    this.config = CONFIG;
    // Get supported types from CONFIG.ITEM_TYPES values
    this.supportedTypes = Object.values(CONFIG.ITEM_TYPES);
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
      onProgress,
      onItemComplete
    } = options;

    if (!Array.isArray(items) || items.length === 0) {
      throw ConversionError.validation('No items provided for conversion');
    }

    try {
      conversionStatus.setStatus(FileStatus.CONVERTING);

      // Log items being processed
      console.log('Processing items:', items);

      // Use batch conversion if specified and supported
      if (useBatch && items.length > 1) {
        const result = await Converters.convertBatch(items, apiKey);
        if (onItemComplete) {
          items.forEach(item => onItemComplete(item.id, true));
        }
        return [{ success: true, result }];
      }

      // Otherwise process items sequentially
      return await this.processItemsSequentially(
        items,
        apiKey,
        onProgress,
        onItemComplete
      );

    } catch (error) {
      console.error('Failed to process items:', error);
      throw ErrorUtils.wrap(error);
    } finally {
      if (onProgress) onProgress(100);
    }
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
