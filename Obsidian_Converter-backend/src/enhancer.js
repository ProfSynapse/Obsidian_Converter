// enhancer.js
import { callLLMWithRetry } from './llm.js';
import config from '../config/default.json' assert { type: "json" };

/**
 * Enhance a markdown note with front matter and wikilinks
 * @param {string} content - The original markdown content
 * @param {string} fileName - The name of the file (without extension)
 * @param {string} apiKey - The OpenAI API key
 * @returns {Promise<string>} The enhanced markdown content
 */
export async function enhanceNote(content, fileName, apiKey) {
  try {
    console.log('Enhancing note:', fileName);
    
    // Parse existing front matter
    const { frontMatter: existingFrontMatter, content: contentWithoutFrontMatter } = parseFrontMatter(content);
    
    // Generate new front matter
    const newFrontMatter = await generateFrontMatter(contentWithoutFrontMatter, fileName, apiKey);
    
    // Merge existing and new front matter
    const mergedFrontMatter = mergeFrontMatter(existingFrontMatter, newFrontMatter);
    
    // Format the merged front matter
    const formattedFrontMatter = formatFrontMatter(mergedFrontMatter);
    
    const wikilinks = await suggestWikilinks(contentWithoutFrontMatter, apiKey);
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
 * @param {string} apiKey - The OpenAI API key
 * @returns {Promise<Object>} The generated front matter
 */
async function generateFrontMatter(content, fileName, apiKey) {
  const frontMatterPrompt = [
    { role: "system", content: config.frontMatter.systemPrompt },
    { role: "user", content: `File name: ${fileName}\n\nContent: ${content.substring(0, 1000)}` }
  ];

  try {
    const frontMatterResponse = await callLLMWithRetry(frontMatterPrompt, true, {
      model: config.llm.model,
      temperature: config.frontMatter.temperature,
      max_tokens: config.frontMatter.max_tokens
    }, apiKey);
    
    if (frontMatterResponse && 
        frontMatterResponse.frontMatter &&
        typeof frontMatterResponse.frontMatter.title === 'string' && 
        typeof frontMatterResponse.frontMatter.description === 'string' && 
        Array.isArray(frontMatterResponse.frontMatter.tags) &&
        Array.isArray(frontMatterResponse.frontMatter.relationships)) {
      return frontMatterResponse.frontMatter;
    } else {
      console.error('Unexpected front matter response format:', frontMatterResponse);
      return { title: fileName, description: "Error generating description", tags: [], relationships: [] };
    }
  } catch (error) {
    console.error('Error generating front matter:', error);
    return { title: fileName, description: "Error generating description", tags: [], relationships: [] };
  }
}

/**
 * Suggest potential wikilinks for the markdown content
 * @param {string} content - The markdown content
 * @param {string} apiKey - The OpenAI API key
 * @returns {Promise<string[]>} An array of suggested wikilinks
 */
async function suggestWikilinks(content, apiKey) {
  const wikilinksPrompt = [
    { role: "system", content: config.wikilinks.systemPrompt },
    { role: "user", content: `Please suggest relevant wikilinks for the following content:\n\n${content.substring(0, 2000)}` }
  ];

  try {
    const wikilinksResponse = await callLLMWithRetry(wikilinksPrompt, true, {
      model: config.llm.model,
      temperature: config.wikilinks.temperature,
      max_tokens: config.wikilinks.max_tokens
    }, apiKey);
    
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
  const appliedWikilinks = new Set();

  wikilinks.forEach(wikilink => {
    if (appliedWikilinks.has(wikilink)) return;

    const regex = new RegExp(`\\b${escapeRegExp(wikilink)}\\b`, 'gi');
    let isApplied = false;

    result = result.replace(regex, (match, offset) => {
      const prevChar = result.charAt(offset - 1);
      const nextChar = result.charAt(offset + match.length);
      if (prevChar === '[' && nextChar === ']') {
        return match;
      }

      const prevFiveChars = result.slice(Math.max(0, offset - 5), offset);
      if (prevFiveChars.includes('http') || prevFiveChars.includes('www.')) {
        return match;
      }

      isApplied = true;
      return `[[${match}]]`;
    });

    if (isApplied) {
      appliedWikilinks.add(wikilink);
    }
  });

  return result;
}

/**
 * Format the front matter data into a YAML block
 * @param {Object} frontMatterData - The front matter data object
 * @returns {string} Formatted YAML front matter block
 */
function formatFrontMatter(frontMatterData) {
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
 * Parse front matter from a markdown string
 * @param {string} content - The markdown content
 * @returns {Object} An object containing the front matter and the rest of the content
 */
function parseFrontMatter(content) {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontMatterRegex);
  if (!match) return { frontMatter: null, content };

  const frontMatterString = match[1];
  const frontMatter = {};
  frontMatterString.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      const value = valueParts.join(':').trim();
      frontMatter[key.trim()] = value.startsWith('[') && value.endsWith(']') 
        ? value.slice(1, -1).split(',').map(item => item.trim())
        : value;
    }
  });

  const contentWithoutFrontMatter = content.slice(match[0].length).trim();
  return { frontMatter, content: contentWithoutFrontMatter };
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
  
  // Merge relationships if both exist
  if (existing && existing.relationships && newFrontMatter.relationships) {
    merged.relationships = [...new Set([...existing.relationships, ...newFrontMatter.relationships])];
  }
  
  return merged;
}