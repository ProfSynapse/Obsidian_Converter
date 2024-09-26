// backend/src/enhancers/imageEnhancer.js

import EnhancerInterface from './enhancerInterface.js';
import { loadPromptsConfig } from '../utils/promptLoader.js';
import { callLLMWithRetry } from '../services/llm.js';
import logger from '../utils/logger.js';

/**
 * @file imageEnhancer.js
 * @description Enhancer for Image files. Generates alt text.
 */
export default class ImageEnhancer extends EnhancerInterface {
  constructor() {
    super();
    this.config = null;
  }

  /**
   * Loads the configuration if not already loaded.
   * @returns {Promise<void>}
   */
  async loadConfig() {
    if (!this.config) {
      this.config = await loadPromptsConfig();
    }
  }

  /**
   * Generates alt text for an image.
   * @param {string} imagePath - The path to the image file.
   * @param {string} fileName - The name of the image file.
   * @returns {Promise<Object>} The metadata object with alt text.
   */
  async addMetadata(imagePath, fileName) {
    await this.loadConfig();

    try {
      logger.info(`Generating alt text for image: ${fileName}`);

      // Call the vision-capable LLM to generate alt text
      const altText = await this.generateAltText(imagePath, fileName);

      const metadata = {
        altText,
        fileType: 'image',
      };

      logger.info(`Alt text generated: ${altText}`);

      return metadata;
    } catch (error) {
      logger.error(`Error generating alt text: ${error.message}`);
      return { altText: 'No description available.', fileType: 'image' };
    }
  }

  /**
   * Generates alt text using a vision-capable LLM.
   * @param {string} imagePath - The path to the image file.
   * @param {string} fileName - The name of the image file.
   * @returns {Promise<string>} The generated alt text.
   */
  async generateAltText(imagePath, fileName) {
    const imageAltTextPrompt = [
      { role: 'system', content: this.config.imageAltText.systemPrompt },
      { role: 'user', content: `Image Name: ${fileName}\n\nPlease describe the image in detail.` },
    ];

    try {
      const altTextResponse = await callLLMWithRetry(imageAltTextPrompt, true, {
        temperature: this.config.imageAltText.temperature,
        max_tokens: this.config.imageAltText.max_tokens,
      });

      if (typeof altTextResponse.altText === 'string') {
        return altTextResponse.altText;
      } else {
        logger.warn('Unexpected alt text response format.');
        return 'No description available.';
      }
    } catch (error) {
      logger.error(`Error generating alt text: ${error.message}`);
      return 'No description available.';
    }
  }

  /**
   * Generates a summary for the image content if needed.
   * @param {string} content - The content to summarize.
   * @returns {Promise<string>} The generated summary.
   */
  async generateSummary(content) {
    // Image enhancer might not require a summary, but method is implemented for interface compliance
    return '';
  }
}
