/**
 * Event Handlers for Electron IPC Communication
 * 
 * Manages event registration and cleanup for IPC communication between
 * renderer and main processes. Also handles status updates and progress tracking.
 * 
 * Related files:
 * - client.js: Core client functionality
 * - converters/*.js: Converter implementations using these handlers
 */

import { conversionStatus } from '../../stores/conversionStatus.js';

/**
 * Maps conversion events to conversionStatus store methods
 * @private
 */
const statusActions = {
  initializing: (state) => {
    conversionStatus.setStatus('initializing');
    conversionStatus.setProgress(0);
  },
  converting: (state) => {
    conversionStatus.setStatus('converting');
    if (state.file) {
      conversionStatus.setCurrentFile(state.file);
    }
  },
  completed: (state) => {
    conversionStatus.setStatus('completed');
    conversionStatus.setProgress(100);
    conversionStatus.setCurrentFile(null);
  },
  error: (state) => {
    conversionStatus.setStatus('error');
    conversionStatus.setError(state.error || 'Unknown error occurred');
  },
  cancelled: () => {
    conversionStatus.setStatus('cancelled');
    conversionStatus.setProgress(0);
    conversionStatus.setCurrentFile(null);
  }
};

/**
 * Manages active conversion requests
 */
class EventHandlerManager {
  constructor() {
    this.activeRequests = new Map();
  }

  /**
   * Registers event handlers for a conversion job
   * @param {string} jobId Unique identifier for the conversion job
   * @param {string} fileIdentifier Path or identifier of the file/resource being converted
   * @param {Function} onProgress Callback for progress updates
   * @param {Function} [onItemComplete] Optional callback for batch operations
   * @returns {Object} Object containing the registered event handlers
   */
  registerHandlers(jobId, fileIdentifier, onProgress = null, onItemComplete = null) {
    const handlers = {
      progress: (event, data) => {
        if (data.file === fileIdentifier || (data.id && this.activeRequests.has(data.id))) {
          // Update progress
          conversionStatus.setProgress(data.progress);
          if (data.file) {
            conversionStatus.setCurrentFile(data.file);
          }
          
          if (onProgress) {
            onProgress(data.progress, data);
          }
        }
      },
      
      status: (event, data) => {
        if (this.activeRequests.has(data.id)) {
          const action = statusActions[data.status];
          if (action) {
            action(data);
          } else {
            conversionStatus.setStatus(data.status);
          }
        }
      },
      
      complete: (event, data) => {
        if (this.activeRequests.has(data.id)) {
          statusActions.completed(data);
          
          if (onItemComplete) {
            onItemComplete(data);
          }
          
          this.removeHandlers(data.id);
          this.activeRequests.delete(data.id);
        }
      },
      
      error: (event, data) => {
        if (this.activeRequests.has(data.id)) {
          statusActions.error(data);
          
          this.removeHandlers(data.id);
          this.activeRequests.delete(data.id);
        }
      }
    };

    try {
      // Register event handlers
      window.electronAPI.onConversionProgress(handlers.progress);
      window.electronAPI.onConversionStatus(handlers.status);
      window.electronAPI.onConversionComplete(handlers.complete);
      window.electronAPI.onConversionError(handlers.error);

      // Store handlers for cleanup
      this.activeRequests.set(jobId, {
        id: jobId,
        handlers
      });

      return handlers;
    } catch (error) {
      // If registration fails, clean up any handlers that were registered
      if (this.activeRequests.has(jobId)) {
        this.removeHandlers(jobId);
        this.activeRequests.delete(jobId);
      }
      throw error;
    }
  }

  /**
   * Removes event handlers for a conversion job
   * @param {string} jobId Unique identifier for the conversion job
   */
  removeHandlers(jobId) {
    if (this.activeRequests.has(jobId)) {
      const { handlers } = this.activeRequests.get(jobId);
      
      // Remove event listeners
      window.electronAPI.offConversionProgress(handlers.progress);
      window.electronAPI.offConversionStatus(handlers.status);
      window.electronAPI.offConversionComplete(handlers.complete);
      window.electronAPI.offConversionError(handlers.error);
    }
  }

  /**
   * Removes all active event handlers
   */
  removeAllHandlers() {
    for (const [jobId] of this.activeRequests) {
      this.removeHandlers(jobId);
    }
    this.activeRequests.clear();
  }

  /**
   * Gets an active request by ID
   * @param {string} jobId Request ID
   * @returns {Object|undefined} The request object if found
   */
  getRequest(jobId) {
    return this.activeRequests.get(jobId);
  }

  /**
   * Checks if a request is active
   * @param {string} jobId Request ID
   * @returns {boolean} Whether the request is active
   */
  isActive(jobId) {
    return this.activeRequests.has(jobId);
  }
}

// Create and export singleton instance
const eventHandlerManager = new EventHandlerManager();
export default eventHandlerManager;
