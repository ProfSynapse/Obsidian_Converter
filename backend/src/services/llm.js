// backend/src/services/llm.js

import axios from 'axios';
import logger from '../utils/logger.js';
import { loadPromptsConfig } from '../utils/promptLoader.js';

/**
 * @file llm.js
 * @description Service functions to interact with the LLM provider.
 */

/**
 * Calls the LLM with retry logic.
 * @param {Array} prompt - The prompt array for the LLM.
 * @param {boolean} expectJson - Whether to expect JSON output.
 * @param {Object} options - Additional options like temperature and max_tokens.
 * @returns {Promise<Object>} The LLM response.
 */
export async function callLLMWithRetry(prompt, expectJson = false, options = {}) {
  const maxRetries = 3;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Load the prompts configuration to get the model name
  const config = await loadPromptsConfig();
  const modelName = config.model || 'gpt-4o-mini'; // Fallback to 'gpt-4o-mini' if not specified

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(process.env.OPENAI_API_URL, {
        model: modelName,       // Dynamically set the model name
        messages: prompt,       // OpenAI expects 'messages' for Chat Completions
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 150,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      });

      if (expectJson) {
        const data = response.data.choices[0].message.content.trim();

        try {
          const jsonData = JSON.parse(data);
          return jsonData;
        } catch (parseError) {
          logger.error(`Failed to parse JSON response from LLM: ${parseError.message}`);
          throw new Error('LLM response is not valid JSON');
        }
      }

      return response.data;
    } catch (error) {
      logger.error(`LLM call attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        logger.info(`Retrying in ${attempt * 1000}ms...`);
        await delay(attempt * 1000); // Exponential backoff
      } else {
        throw new Error('LLM call failed after maximum retries');
      }
    }
  }
}
