/**
 * API Key Service
 * Provides secure storage and management of API keys using machine-specific encryption.
 * 
 * Related files:
 * - main.js: Main process setup with encryption key
 * - ipc/handlers/apikey/index.js: IPC handlers for API key operations
 * - preload.js: API exposure to renderer
 */

const Store = require('electron-store');
const fetch = require('node-fetch');

class ApiKeyService {
  constructor() {
    // Initialize store with encryption key from environment
    this.store = new Store({
      name: 'api-keys',
      encryptionKey: process.env.STORE_ENCRYPTION_KEY
    });
  }

  /**
   * Save an API key securely
   * @param {string} key - The API key to save
   * @param {string} provider - The API provider (e.g., 'openai')
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async saveApiKey(key, provider = 'openai') {
    try {
      if (!this.isValidApiKeyFormat(key, provider)) {
        return { 
          success: false, 
          error: `Invalid ${provider} API key format` 
        };
      }
      
      this.store.set(`${provider}-api-key`, key);
      
      return { success: true };
    } catch (error) {
      console.error('Error saving API key:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to save API key' 
      };
    }
  }

  /**
   * Get an API key
   * @param {string} provider - The API provider (e.g., 'openai')
   * @returns {string|null} The API key or null if not found
   */
  getApiKey(provider = 'openai') {
    return this.store.get(`${provider}-api-key`, null);
  }

  /**
   * Check if an API key exists
   * @param {string} provider - The API provider (e.g., 'openai')
   * @returns {boolean} True if the API key exists
   */
  hasApiKey(provider = 'openai') {
    return !!this.getApiKey(provider);
  }

  /**
   * Delete an API key
   * @param {string} provider - The API provider (e.g., 'openai')
   * @returns {{success: boolean, error?: string}}
   */
  deleteApiKey(provider = 'openai') {
    try {
      this.store.delete(`${provider}-api-key`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting API key:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to delete API key' 
      };
    }
  }

  /**
   * Validate an API key format
   * @param {string} key - The API key to validate
   * @param {string} provider - The API provider (e.g., 'openai')
   * @returns {boolean} True if the key format is valid
   */
  isValidApiKeyFormat(key, provider = 'openai') {
    if (!key || typeof key !== 'string') {
      return false;
    }

    // OpenAI API key format validation
    if (provider === 'openai') {
      return /^sk-[A-Za-z0-9]{32,}$/.test(key);
    }

    // Default validation for other providers
    return key.length >= 16;
  }

  /**
   * Validate an API key with the provider's API
   * @param {string} key - The API key to validate
   * @param {string} provider - The API provider (e.g., 'openai')
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async validateApiKey(key, provider = 'openai') {
    try {
      if (!this.isValidApiKeyFormat(key, provider)) {
        return { 
          valid: false, 
          error: `Invalid ${provider} API key format` 
        };
      }

      if (provider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${key}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return { 
            valid: false, 
            error: errorData.error?.message || 'Invalid API key' 
          };
        }
        
        return { valid: true };
      }
      
      // Default validation for other providers
      return { valid: true };
    } catch (error) {
      console.error('API key validation error:', error);
      return { 
        valid: false, 
        error: error.message || 'Network error during validation' 
      };
    }
  }
}

module.exports = new ApiKeyService();
