// backend/src/outputFormatters/formatterInterface.js

/**
 * @file formatterInterface.js
 * @description Defines the Formatter interface that all formatters must implement.
 */
export default class FormatterInterface {
    /**
     * Formats the content into the desired file type.
     * @param {string} content - The enhanced content with metadata and summary.
     * @returns {Promise<Buffer>} The formatted file as a buffer.
     */
    async format(content) {
      throw new Error('format method not implemented.');
    }
  }
  