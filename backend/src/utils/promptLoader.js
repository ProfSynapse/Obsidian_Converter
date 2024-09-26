// backend/src/utils/promptLoader.js

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirnamePath = dirname(__filename);

const configPath = path.join(__dirnamePath, '..', 'config', 'prompts.yaml');

/**
 * @file promptLoader.js
 * @description Loads and parses the prompts YAML configuration file.
 */

let configCache = null;

/**
 * Loads the YAML configuration file.
 * @returns {Promise<Object>} Parsed configuration object.
 */
export async function loadPromptsConfig() {
  if (configCache) {
    return configCache;
  }

  try {
    const fileContents = await fs.readFile(configPath, 'utf8');
    const data = yaml.load(fileContents);
    configCache = data;
    logger.info('Prompts configuration loaded successfully.');
    return data;
  } catch (error) {
    logger.error(`Error loading prompts configuration: ${error.message}`);
    throw new Error('Failed to load prompts configuration');
  }
}
