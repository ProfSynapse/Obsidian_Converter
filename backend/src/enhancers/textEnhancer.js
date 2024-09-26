// backend/src/enhancers/textEnhancer.js

import EnhancerInterface from './enhancerInterface.js';
import { callLLMWithRetry } from '../services/llm.js';
import logger from '../utils/logger.js';
import { loadPromptsConfig } from '../utils/promptLoader.js';

/**
 * @file textEnhancer.js
 * @description Enhancer for Text content. Generates metadata and summaries.
 */
export default class TextEnhancer extends EnhancerInterface {
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
   * Adds metadata to the text content.
   * @param {string} content - The original text content.
   * @param {string} fileName - The name of the file.
   * @returns {Promise<Object>} The metadata object.
   */
  async addMetadata(content, fileName) {
    await this.loadConfig();

    try {
      logger.info(`Generating metadata for text file: ${fileName}`);

      // Generate metadata
      const metadata = await this.generateMetadata(content, fileName);

      logger.info('Metadata generation completed');

      return metadata;
    } catch (error) {
      logger.error(`Error enhancing text file: ${error.message}`);
      return {}; // Return empty metadata if enhancement fails
    }
  }

  /**
   * Generates metadata using LLM.
   * @param {string} content - The text content.
   * @param {string} fileName - The name of the file.
   * @returns {Promise<Object>} The generated metadata.
   */
  async generateMetadata(content, fileName) {
    const frontMatterPrompt = [
      { role: 'system', content: this.config.frontMatter.systemPrompt },
      { role: 'user', content: `File name: ${fileName}\n\nContent: ${content.substring(0, 1000)}` },
    ];

    try {
      const metadataResponse = await callLLMWithRetry(frontMatterPrompt, true, {
        temperature: this.config.frontMatter.temperature,
        max_tokens: this.config.frontMatter.max_tokens,
      });

      if (
        metadataResponse &&
        typeof metadataResponse.title === 'string' &&
        typeof metadataResponse.description === 'string' &&
        Array.isArray(metadataResponse.tags) &&
        typeof metadataResponse.fileType === 'string'
      ) {
        return metadataResponse;
      } else {
        logger.warn('Unexpected metadata response format.');
        return { title: fileName, description: 'No description available.', tags: [], fileType: 'txt' };
      }
    } catch (error) {
      logger.error(`Error generating metadata: ${error.message}`);
      return { title: fileName, description: 'No description available.', tags: [], fileType: 'txt' };
    }
  }

  /**
   * Generates a summary using LLM.
   * @param {string} content - The content to summarize.
   * @returns {Promise<string>} The generated summary.
   */
  async generateSummary(content) {
    const summaryPrompt = [
      { role: 'system', content: this.config.summary.systemPrompt },
      { role: 'user', content: `Please provide a concise summary for the following content:\n\n${content.substring(0, 2000)}` },
    ];

    try {
      const summaryResponse = await callLLMWithRetry(summaryPrompt, true, {
        temperature: this.config.summary.temperature,
        max_tokens: this.config.summary.max_tokens,
      });

      if (typeof summaryResponse.summary === 'string') {
        return summaryResponse.summary;
      } else {
        logger.warn('Unexpected summary response format.');
        return 'No summary available.';
      }
    } catch (error) {
      logger.error(`Error generating summary: ${error.message}`);
      return 'No summary available.';
    }
  }
}
