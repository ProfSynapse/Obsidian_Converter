/**
 * Utility functions for file type handling that mirror frontend config
 */

const API_REQUIRED_TYPES = [
  'mp3', 'wav', 'ogg', 'm4a', 'mpga',
  'mp4', 'webm', 'avi', 'mov', 'mpeg'
];

const FILE_CATEGORIES = {
  documents: ['txt', 'rtf', 'pdf', 'docx', 'odt', 'epub', 'doc'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'wma'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
  data: ['csv', 'json', 'yaml', 'yml', 'xlsx', 'pptx'],
  web: ['html', 'htm', 'xml']
};

export function requiresApiKey(fileType) {
  if (!fileType) return false;
  return API_REQUIRED_TYPES.includes(fileType.toLowerCase());
}

export function determineCategory(type, fileType) {
  // Special handling for URL types
  if (type === 'url' || type === 'parenturl' || type === 'youtube') {
    return 'web';
  }
  
  // Look up category from mapping
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(fileType?.toLowerCase())) {
      return category;
    }
  }
  
  return 'others';
}
