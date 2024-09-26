// backend/src/enhancers/enhancerInterface.js

/**
 * @file enhancerInterface.js
 * @description Defines the Enhancer interface that all enhancers must implement.
 */
export default class EnhancerInterface {
    /**
     * Adds metadata to the given content.
     * @param {string} content - The original text content.
     * @param {string} fileName - The name of the file.
     * @returns {Promise<Object>} The metadata object.
     */
    async addMetadata(content, fileName) {
      throw new Error('addMetadata method not implemented.');
    }
  
    /**
     * Generates a summary for the given content.
     * @param {string} content - The content to summarize.
     * @returns {Promise<string>} The generated summary.
     */
    async generateSummary(content) {
      throw new Error('generateSummary method not implemented.');
    }
  }
  