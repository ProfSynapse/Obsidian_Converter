// src/lib/api/config.js

/**
 * Global configuration for the conversion application
 * @const {Object} CONFIG
 */
export const CONFIG = {
    // API Configuration
    API: {
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000,
        TIMEOUT: 300000,
        BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1',
        HEADERS: {
            'Accept': 'application/json, application/zip, application/octet-stream',
            'Content-Type': 'application/json'
        }
    },

    // Item Types Configuration
    ITEM_TYPES: {
        FILE: 'file',
        URL: 'url',
        PARENT_URL: 'parent',
        YOUTUBE: 'youtube',
        BATCH: 'batch'
    },

    // Progress States
    PROGRESS: {
        START: 0,
        VALIDATING: 10,
        PREPARING: 20,
        CONVERTING: 40,
        PROCESSING: 60,
        FINALIZING: 80,
        COMPLETE: 100
    },

    // Conversion Options
    CONVERSION: {
        SUPPORTED_TYPES: ['file', 'url', 'parent', 'youtube', 'batch'],
        DEFAULT_OPTIONS: {
            includeImages: true,
            includeMeta: true,
            maxDepth: 1,
            convertLinks: true
        },
        BATCH_SIZE_LIMIT: 10,
        FILE_SIZE_LIMIT: 50 * 1024 * 1024, // 50MB
    },

    // Status Codes
    STATUS: {
        SUCCESS: 'success',
        ERROR: 'error',
        PENDING: 'pending',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    },

    // Error Types
    ERROR_TYPES: {
        VALIDATION: 'VALIDATION_ERROR',
        NETWORK: 'NETWORK_ERROR',
        CONVERSION: 'CONVERSION_ERROR',
        TIMEOUT: 'TIMEOUT_ERROR',
        UNKNOWN: 'UNKNOWN_ERROR'
    }
};

// Freeze the configuration to prevent modifications
Object.freeze(CONFIG);