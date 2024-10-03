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
    
    if (!config.llm || !config.llm.model || !config.llm.temperature || !config.llm.max_tokens) {
      throw new Error('Missing required LLM configuration');
    }
    if (!config.vision || !config.vision.model || !config.vision.temperature || !config.vision.max_tokens) {
      throw new Error('Missing required Vision configuration');
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
 * @returns {Promise} The LLM response
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
 * Call the OpenAI Vision API to generate alt text for an image
 * @param {string} base64Image - The base64-encoded image data
 * @returns {Promise<string>} The generated alt text
 */
export async function callVisionModel(base64Image) {
  if (!config) await loadConfig();

  const requestBody = {
    model: config.vision.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Generate a concise, descriptive alt text for this image." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ]
      }
    ],
    max_tokens: config.vision.max_tokens,
    temperature: config.vision.temperature
  };

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
      throw new Error(`Vision API request failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI Vision API:', error);
    throw error;
  }
}

/**
 * Reload the configuration file
 * @returns {Promise}
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
 * @returns {Promise} The result of the function call
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
 * @returns {Promise} The LLM response
 */
export async function callLLMWithRetry(messages, jsonMode = false, options = {}) {
  return retry(() => callLLM(messages, jsonMode, options));
}import { Configuration, OpenAIApi } from 'openai';

export async function callLLMWithRetry(messages, jsonResponse = false, options = {}, apiKey) {
  const configuration = new Configuration({
    apiKey: apiKey,
  });
  const openai = new OpenAIApi(configuration);

  // Implement retry logic here
  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 150,
      response_format: jsonResponse ? { type: "json_object" } : undefined,
    });

    if (jsonResponse) {
      return JSON.parse(response.data.choices[0].message.content);
    } else {
      return response.data.choices[0].message.content;
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}