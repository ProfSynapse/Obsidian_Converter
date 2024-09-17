// llm.js - OpenAI API interaction

import fetch from 'node-fetch';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let config;

async function loadConfig() {
  try {
    const configPath = join(__dirname, '..', 'config', 'default.json');
    const configFile = await readFile(configPath, 'utf8');
    config = JSON.parse(configFile);
    
    // Ensure required fields are present
    if (!config.llm || !config.llm.model || !config.llm.temperature || !config.llm.max_tokens) {
      throw new Error('Missing required LLM configuration');
    }
  } catch (error) {
    console.error('Error loading configuration:', error);
    throw error;
  }
}

// Load config immediately
await loadConfig();

/**
 * Call the OpenAI API with given messages and options
 * @param {Array} messages - The messages to send to the LLM
 * @param {boolean} jsonMode - Whether to request JSON output
 * @param {Object} options - Additional options (temperature, max_tokens)
 * @returns {Promise<Object|string>} The LLM response
 */
export async function callLLM(messages, jsonMode = false, options = {}) {
  if (!config) await loadConfig();

  const requestBody = {
    model: options.model || config.llm.model,
    messages: messages,
    temperature: options.temperature || config.llm.temperature,
    max_tokens: options.max_tokens || config.llm.max_tokens
  };

  if (jsonMode) {
    requestBody.response_format = { type: 'json_object' };
  }

  // Add this line to log the API key (be careful with this in production!)
  console.log('Using API Key:', process.env.OPENAI_API_KEY);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API request failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('API response does not contain expected choices');
    }

    const content = data.choices[0].message?.content;
    if (content === undefined) {
      throw new Error('API response does not contain expected content');
    }

    return jsonMode ? JSON.parse(content) : content;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

/**
 * Reload the configuration file
 * @returns {Promise<void>}
 */
export async function reloadConfig() {
  try {
    await loadConfig();
    console.log('Configuration reloaded successfully');
  } catch (error) {
    console.error('Error reloading configuration:', error);
  }
}

/**
 * Retry mechanism for API calls
 * @param {Function} fn - The function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in milliseconds
 * @returns {Promise<any>} The result of the function call
 */
async function retry(fn, maxRetries = 3, delay = 1000) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/**
 * Call the LLM API with retry mechanism
 * @param {Array} messages - The messages to send to the LLM
 * @param {boolean} jsonMode - Whether to request JSON output
 * @param {Object} options - Additional options (temperature, max_tokens)
 * @returns {Promise<Object|string>} The LLM response
 */
export async function callLLMWithRetry(messages, jsonMode = false, options = {}) {
  return retry(() => callLLM(messages, jsonMode, options));
}