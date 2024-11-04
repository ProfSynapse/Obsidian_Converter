// routes/convert/utils/categoryDetector.js

/**
 * Utility function to determine if a file type requires an API key
 */
export function requiresApiKey(fileType) {
    if (!fileType) return false;
    const API_REQUIRED_TYPES = ['mp3', 'wav', 'ogg', 'mp4', 'mov', 'avi', 'webm'];
    return API_REQUIRED_TYPES.includes(fileType.toLowerCase());
  }
  
  /**
 * Determines the category based on the item type or file extension
 */
export function determineCategory(type, fileType) {
    if (type === 'url' || type === 'parenturl' || type === 'youtube') return 'web';
  
    const dataTypes = ['csv', 'xls', 'xlsx', 'json'];
    const multimediaTypes = ['mp3', 'wav', 'ogg', 'mp4', 'mov', 'avi', 'webm'];
    const textTypes = ['txt', 'doc', 'docx', 'pdf'];
  
    if (dataTypes.includes(fileType)) return 'data';
    if (multimediaTypes.includes(fileType)) return 'multimedia';
    if (textTypes.includes(fileType)) return 'text';
    return 'others'; // For any other types
  }
  