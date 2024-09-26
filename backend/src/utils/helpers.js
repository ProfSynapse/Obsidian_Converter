// backend/src/utils/helpers.js

/**
 * @file helpers.js
 * @description Helper functions for enhancers.
 */

/**
 * Parses front matter from markdown content.
 * @param {string} content - The markdown content.
 * @returns {Object} An object containing existing front matter and content without front matter.
 */
export function parseFrontMatter(content) {
    const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);
    if (match) {
      const frontMatter = YAML.parse(match[1]); // Assuming you have YAML.parse available
      const contentWithoutFrontMatter = match[2];
      return { frontMatter, content: contentWithoutFrontMatter };
    } else {
      return { frontMatter: {}, content };
    }
  }
  
  /**
   * Merges existing and new front matter.
   * @param {Object} existing - Existing front matter object.
   * @param {Object} newFrontMatter - New front matter object.
   * @returns {Object} Merged front matter object.
   */
  export function mergeFrontMatter(existing, newFrontMatter) {
    const merged = { ...existing, ...newFrontMatter };
  
    // Merge tags if both exist
    if (existing.tags && newFrontMatter.tags) {
      merged.tags = [...new Set([...existing.tags, ...newFrontMatter.tags])];
    }
  
    return merged;
  }
  
  /**
   * Formats front matter data into a YAML block.
   * @param {Object} frontMatterData - The front matter data object.
   * @returns {string} Formatted YAML front matter block.
   */
  export function formatFrontMatter(frontMatterData) {
    // Convert frontMatterData to YAML string
    const yaml = require('js-yaml');
    const formatted = yaml.dump(frontMatterData);
    return `---\n${formatted}---\n`;
  }
  
  /**
   * Applies wikilinks to the content based on suggestions.
   * @param {string} content - The original content.
   * @param {string[]} wikilinks - An array of suggested wikilinks.
   * @returns {string} Content with wikilinks applied.
   */
  export function applyWikilinks(content, wikilinks) {
    let result = content;
    const appliedWikilinks = new Set(); // Keep track of applied wikilinks
  
    wikilinks.forEach((wikilink) => {
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
        return `[[${match}]]`;
      });
  
      if (isApplied) {
        appliedWikilinks.add(wikilink);
      }
    });
  
    return result;
  }
  
  /**
   * Escapes special characters in a string for use in a regular expression.
   * @param {string} string - The string to escape.
   * @returns {string} The escaped string.
   */
  export function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  