/**
 * Audio Converter Adapter
 * 
 * Adapts the backend audio converter for use in the Electron main process.
 * Uses the BaseModuleAdapter for consistent module loading and error handling.
 * 
 * Related files:
 * - backend/src/services/converter/multimedia/audioconverter.js: Original implementation
 * - src/electron/services/ElectronConversionService.js: Service using this adapter
 * - src/electron/adapters/BaseModuleAdapter.js: Base adapter class
 * - src/electron/services/ApiKeyService.js: API key management
 */
const BaseModuleAdapter = require('./BaseModuleAdapter');
const ApiKeyService = require('../services/ApiKeyService');

// Create the audio converter adapter
class AudioConverterAdapter extends BaseModuleAdapter {
  constructor() {
    super(
      'src/services/converter/multimedia/audioconverter.js',
      'convertAudioToMarkdown'
    );
  }
  
  /**
   * Convert audio to Markdown
   * @param {Buffer} input - Audio file buffer
   * @param {string} originalName - Original filename
   * @returns {Promise<{content: string, images: Array}>}
   */
  async convertAudioToMarkdown(input, originalName) {
    try {
      // Get API key from secure storage
      const apiKey = await ApiKeyService.getApiKey('openai');
      if (!apiKey) {
        throw new Error('OpenAI API key is required for audio transcription');
      }
      
      console.log(`🎵 Converting audio file: ${originalName}`);
      
      // Call the backend audio converter
      return await this.executeMethod('default', [input, originalName, apiKey]);
    } catch (error) {
      console.error('Audio conversion failed:', error);
      return {
        success: false,
        error: error.message || 'Audio conversion failed'
      };
    }
  }
}

// Create and export a singleton instance
const audioConverterAdapter = new AudioConverterAdapter();

module.exports = {
  convertAudioToMarkdown: (...args) => audioConverterAdapter.convertAudioToMarkdown(...args),
  audioConverterAdapter
};
