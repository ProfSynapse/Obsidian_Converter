// enhancer.js - Note enhancement logic with configuration

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { callLLMWithRetry } from './llm.js';
import { parseFrontMatter } from './utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let config;

async function loadConfig() {
  try {
    const configPath = join(__dirname, '..', 'config', 'default.json');
    const configFile = await readFile(configPath, 'utf8');
    config = JSON.parse(configFile);
    validateConfig(config);
  } catch (error) {
    console.error('Error loading configuration:', error);
    throw new Error('Failed to load configuration');
  }
}

function validateConfig(config) {
  const requiredFields = ['frontMatter', 'wikilinks'];
  requiredFields.forEach(field => {
    if (!config[field] || typeof config[field] !== 'object') {
      throw new Error(`Invalid configuration: missing or invalid ${field} field`);
    }
    if (!config[field].systemPrompt || typeof config[field].systemPrompt !== 'string') {
      throw new Error(`Invalid configuration: missing or invalid systemPrompt in ${field}`);
    }
    if (!config[field].temperature || typeof config[field].temperature !== 'number') {
      throw new Error(`Invalid configuration: missing or invalid temperature in ${field}`);
    }
    if (!config[field].max_tokens || typeof config[field].max_tokens !== 'number') {
      throw new Error(`Invalid configuration: missing or invalid max_tokens in ${field}`);
    }
  });
}

// Load config immediately
await loadConfig();

/**
 * Enhance a markdown note with front matter and wikilinks
 * @param {string} content - The original markdown content
 * @param {string} fileName - The name of the file (without extension)
 * @returns {Promise<string>} The enhanced markdown content
 */
export async function enhanceNote(content, fileName, apiKey) {
  if (!config) await loadConfig();

  try {
    console.log('Enhancing note:', fileName);
    
    // Parse existing front matter
    const { frontMatter: existingFrontMatter, content: contentWithoutFrontMatter } = parseFrontMatter(content);
    
    // Generate new front matter
    const newFrontMatter = await generateFrontMatter(contentWithoutFrontMatter, fileName);
    
    // Merge existing and new front matter
    const mergedFrontMatter = mergeFrontMatter(existingFrontMatter, newFrontMatter);
    
    // Format the merged front matter
    const formattedFrontMatter = formatFrontMatter(mergedFrontMatter);
    
    const wikilinks = await suggestWikilinks(contentWithoutFrontMatter);
    console.log('Wikilinks suggested:', wikilinks);

    const contentWithWikilinks = applyWikilinks(contentWithoutFrontMatter, wikilinks);
    console.log('Wikilinks applied to content');

    const enhancedContent = `${formattedFrontMatter}\n${contentWithWikilinks}`;
    console.log('Note enhancement completed');

    return enhancedContent;
  } catch (error) {
    console.error('Error enhancing note:', error);
    return content; // Return original content if enhancement fails
  }
}

/**
 * Generate front matter for the markdown content
 * @param {string} content - The markdown content
 * @param {string} fileName - The name of the file (without extension)
 * @returns {Promise<string>} The generated front matter
 */
async function generateFrontMatter(content, fileName, apiKey) {
  const frontMatterPrompt = [
    { role: "system", content: config.frontMatter.systemPrompt },
    { role: "user", content: `File name: ${fileName}\n\nContent: ${content.substring(0, 1000)}` }
  ];

  try {
    const frontMatterResponse = await callLLMWithRetry(frontMatterPrompt, true, {
      temperature: config.frontMatter.temperature,
      max_tokens: config.frontMatter.max_tokens
    });
    
    console.log('Front Matter API Response:', JSON.stringify(frontMatterResponse, null, 2));

    if (frontMatterResponse && 
        frontMatterResponse.frontMatter &&
        typeof frontMatterResponse.frontMatter.title === 'string' && 
        typeof frontMatterResponse.frontMatter.description === 'string' && 
        Array.isArray(frontMatterResponse.frontMatter.tags)) {
      return frontMatterResponse.frontMatter;
    } else {
      console.error('Unexpected front matter response format:', frontMatterResponse);
      return { title: fileName, description: "Error generating description", tags: [] };
    }
  } catch (error) {
    console.error('Error generating front matter:', error);
    return { title: fileName, description: "Error generating description", tags: [] };
  }
}

/**
 * Suggest potential wikilinks for the markdown content
 * @param {string} content - The markdown content
 * @returns {Promise<string[]>} An array of suggested wikilinks
 */
async function suggestWikilinks(content, apiKey) {
  const wikilinksPrompt = [
    { role: "system", content: config.wikilinks.systemPrompt },
    { role: "user", content: `Please suggest relevant wikilinks for the following content:\n\n${content.substring(0, 2000)}` }
  ];

  try {
    const wikilinksResponse = await callLLMWithRetry(wikilinksPrompt, true, {
      temperature: config.wikilinks.temperature,
      max_tokens: config.wikilinks.max_tokens
    });
    
    console.log('Wikilinks API Response:', JSON.stringify(wikilinksResponse, null, 2));

    if (wikilinksResponse && 
        wikilinksResponse.wikilinks && 
        Array.isArray(wikilinksResponse.wikilinks.suggestions)) {
      return wikilinksResponse.wikilinks.suggestions;
    } else {
      console.error('Unexpected wikilinks response format:', wikilinksResponse);
      return [];
    }
  } catch (error) {
    console.error('Error suggesting wikilinks:', error);
    return [];
  }
}

/**
 * Apply wikilinks to the content
 * @param {string} content - The original markdown content
 * @param {string[]} wikilinks - An array of suggested wikilinks
 * @returns {string} The content with wikilinks applied
 */
function applyWikilinks(content, wikilinks) {
  let result = content;
  const appliedWikilinks = new Set(); // Keep track of applied wikilinks

  console.log('Applying wikilinks:', wikilinks);

  wikilinks.forEach(wikilink => {
    if (appliedWikilinks.has(wikilink)) return; // Skip if already applied

    const regex = new RegExp(`\\b${escapeRegExp(wikilink)}\\b`, 'gi');
    let isApplied = false;

    result = result.replace(regex, (match, offset) => {
      // Check if the match is already part of a wikilink
      const prevChar = result.charAt(offset - 1);
      const nextChar = result.charAt(offset + match.length);
      if (prevChar === '[' && nextChar === ']') {
        return match; // Already a wikilink, don't modify
      }

      // Check if it's part of a URL
      const prevFiveChars = result.slice(Math.max(0, offset - 5), offset);
      if (prevFiveChars.includes('http') || prevFiveChars.includes('www.')) {
        return match; // Part of a URL, don't modify
      }

      isApplied = true;
      console.log(`Applying wikilink: [[${match}]]`);
      return `[[${match}]]`;
    });

    if (isApplied) {
      appliedWikilinks.add(wikilink);
    }
  });

  console.log('Wikilinks applied:', Array.from(appliedWikilinks));
  return result;
}

/**
 * Format the front matter data into a YAML block
 * @param {Object} frontMatterData - The front matter data object
 * @returns {string} Formatted YAML front matter block
 */
function formatFrontMatter(frontMatterData) {
  console.log('Formatting front matter:', JSON.stringify(frontMatterData, null, 2));
  
  let formattedFrontMatter = '---\n';
  if (frontMatterData) {
    for (const [key, value] of Object.entries(frontMatterData)) {
      if (Array.isArray(value)) {
        formattedFrontMatter += `${key}:\n${value.map(item => `  - ${item}`).join('\n')}\n`;
      } else if (typeof value === 'string') {
        formattedFrontMatter += `${key}: "${value}"\n`;
      } else {
        formattedFrontMatter += `${key}: ${value}\n`;
      }
    }
  } else {
    console.error('Invalid front matter data:', frontMatterData);
    return '---\n---\n';
  }
  formattedFrontMatter += '---\n';
  
  console.log('Formatted front matter:', formattedFrontMatter);
  return formattedFrontMatter;
}

/**
 * Escape special characters in a string for use in a regular expression
 * @param {string} string - The string to escape
 * @returns {string} The escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
 * Merge existing and new front matter
 * @param {Object} existing - Existing front matter object
 * @param {Object} newFrontMatter - New front matter object
 * @returns {Object} Merged front matter object
 */
function mergeFrontMatter(existing, newFrontMatter) {
  const merged = { ...existing, ...newFrontMatter };
  
  // Merge tags if both exist
  if (existing && existing.tags && newFrontMatter.tags) {
    merged.tags = [...new Set([...existing.tags, ...newFrontMatter.tags])];
  }
  
  return merged;
}
