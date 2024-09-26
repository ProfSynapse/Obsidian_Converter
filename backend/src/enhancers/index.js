// backend/src/enhancers/index.js

import TextEnhancer from './textEnhancer.js';
// Import other enhancers as they are created in the future

/**
 * @file index.js
 * @description Factory for creating enhancer instances based on file type.
 */

/**
 * Returns the appropriate enhancer instance based on file type.
 * @param {string} fileType - The file type (e.g., 'md', 'pdf', 'jpg').
 * @returns {EnhancerInterface|null} The enhancer instance or null if not found.
 */
export function getEnhancer(fileType) {
  // Define supported text-based file types
  const supportedTextFileTypes = ['md', 'markdown', 'txt', 'pdf']; // Extend as needed

  if (supportedTextFileTypes.includes(fileType.toLowerCase())) {
    return new TextEnhancer();
  }

  // Future enhancements can include more conditions for other enhancer types

  return null;
}
