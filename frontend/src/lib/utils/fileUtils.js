// src/lib/utils/fileUtils.js

const FILE_CATEGORIES = {
    documents: ['txt', 'rtf', 'pdf', 'docx', 'odt', 'epub', 'doc'],
    audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'wma'],
    video: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
    data: ['csv', 'json', 'yaml', 'yml', 'xlsx', 'pptx'],
    web: ['url', 'parenturl', 'youtube'] // Updated web category
};

// Audio and video formats that require API key
export const API_REQUIRED_TYPES = [
  // Audio formats
  'mp3', 'wav', 'ogg', 'm4a', 'mpga',
  // Video formats 
  'mp4', 'webm', 'avi', 'mov', 'mpeg'
];

/**
 * Checks if a file/filetype requires an OpenAI API key for processing
 * @param {File|Object|string} input - The file object, file data, or filetype to check
 * @returns {boolean} - Whether an API key is required
 */
export function requiresApiKey(file) {
  if (!file?.name) return false;
  const extension = file.name.split('.').pop().toLowerCase();
  return API_REQUIRED_TYPES.includes(extension);
}

/**
 * Gets the type of a file based on its extension or type
 * @param {File|String|Object} file - The file object, filename, or file data to check
 * @returns {string} - The file type category
 */
export function getFileType(file) {
    if (!file) return 'unknown';

    // Handle web content types
    if (typeof file === 'object' && file.type) {
        if (['url', 'parenturl', 'youtube'].includes(file.type)) {
            return 'web';
        }
    }

    const extension = (typeof file === 'string' ? file : file.name || '')
        .toLowerCase()
        .split('.')
        .pop();

    // Direct mapping for audio files
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'wma'].includes(extension)) {
        return 'audio';
    }

    for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
        if (extensions.includes(extension)) {
            return category;
        }
    }

    return 'unknown';
}

/**
 * Validates if a file has a supported extension
 * @param {File|String} file - The file object or filename to check
 * @returns {boolean} - Whether the file type is supported
 */
export function isValidFileType(file) {
  if (!file) return false;
  
  const extension = (typeof file === 'string' ? file : file.name || '')
    .toLowerCase()
    .split('.')
    .pop();
    
  return Object.values(FILE_CATEGORIES)
    .flat()
    .includes(extension);
}

/**
 * Gets the file size in a human-readable format
 * @param {number} bytes - The file size in bytes
 * @returns {string} - Formatted file size
 */
export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
}
