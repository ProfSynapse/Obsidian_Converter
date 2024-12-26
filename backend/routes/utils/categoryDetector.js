// routes/utils/categoryDetector.js

/**
 * Utility function to determine if a file type requires an API key
 */
export function requiresApiKey(fileType) {
    if (!fileType) return false;
    const API_REQUIRED_TYPES = ['mp3', 'wav', 'ogg', 'mp4', 'mov', 'avi', 'webm'];
    return API_REQUIRED_TYPES.includes(fileType.toLowerCase());
  }
  
const fileCategories = {
  // Document formats
  'pdf': 'documents',
  'docx': 'documents',
  'odt': 'documents',
  'rtf': 'documents',
  'txt': 'documents',
  'epub': 'documents',
  
  // Data formats
  'csv': 'data',
  'json': 'data',
  'yaml': 'data',
  'yml': 'data',
  'xlsx': 'data',
  
  // Web formats
  'html': 'web',
  'htm': 'web',
  'xml': 'web',
  'url': 'web',
  'parenturl': 'web',
  
  // Multimedia
  'mp3': 'multimedia',
  'wav': 'multimedia',
  'ogg': 'multimedia',
  'mp4': 'multimedia',
  'mov': 'multimedia',
  'avi': 'multimedia',
  'webm': 'multimedia'
};

export function determineCategory(type, fileType) {
  // Special handling for URL types
  if (type === 'url' || type === 'parenturl' || type === 'youtube') {
    return 'web';
  }
  
  // Look up category from mapping
  return fileCategories[fileType?.toLowerCase()] || 'others';
}