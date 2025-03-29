/**
 * Video Converter Adapter
 * 
 * Adapts the backend video converter for use in the Electron main process.
 * Uses the BaseModuleAdapter for consistent module loading and error handling.
 * 
 * Related files:
 * - backend/src/services/converter/multimedia/videoConverter.js: Original implementation
 * - src/electron/services/ElectronConversionService.js: Service using this adapter
 * - src/electron/adapters/BaseModuleAdapter.js: Base adapter class
 * - src/electron/services/ApiKeyService.js: API key management
 */
const BaseModuleAdapter = require('./BaseModuleAdapter');
const ApiKeyService = require('../services/ApiKeyService');

// Create the video converter adapter
class VideoConverterAdapter extends BaseModuleAdapter {
  constructor() {
    super(
      'src/services/converter/multimedia/videoConverter.js',
      'convertVideoToMarkdown'
    );
  }
  
  /**
   * Convert video to Markdown
   * @param {Buffer} input - Video file buffer
   * @param {string} originalName - Original filename
   * @returns {Promise<{content: string, images: Array}>}
   */
  async convertVideoToMarkdown(input, originalName) {
    try {
      // Get API key from secure storage
      const apiKey = await ApiKeyService.getApiKey('openai');
      if (!apiKey) {
        throw new Error('OpenAI API key is required for video transcription');
      }
      
      console.log(`🎬 Converting video file: ${originalName}`);
      
      // Determine MIME type from file extension
      const fileExt = originalName.split('.').pop().toLowerCase();
      const mimeType = `video/${fileExt}`;
      
      // Call the backend video converter with options
      return await this.executeMethod('default', [input, { 
        name: originalName,
        apiKey,
        mimeType
      }]);
    } catch (error) {
      console.error('Video conversion failed:', error);
      return {
        success: false,
        error: error.message || 'Video conversion failed'
      };
    }
  }
}

// Create and export a singleton instance
const videoConverterAdapter = new VideoConverterAdapter();

module.exports = {
  convertVideoToMarkdown: (...args) => videoConverterAdapter.convertVideoToMarkdown(...args),
  videoConverterAdapter
};
