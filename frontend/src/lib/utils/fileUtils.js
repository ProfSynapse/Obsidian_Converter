/**
 * Checks if a file/filetype requires an OpenAI API key for processing
 * @param {File|Object|string} input - The file object, file data, or filetype to check
 * @returns {boolean} - Whether an API key is required
 */
const API_REQUIRED_TYPES = ['mp3', 'wav', 'ogg', 'mp4', 'mov', 'avi', 'webm'];

export function requiresApiKey(input) {
    if (!input) return false;

    const extension = (input.name || input.filename || '')
        .toLowerCase()
        .split('.')
        .pop();
    
    const type = (input.type || input.fileType || '').toLowerCase();

    return API_REQUIRED_TYPES.includes(extension) || 
           API_REQUIRED_TYPES.includes(type) ||
           type.startsWith('audio/') ||
           type.startsWith('video/');
}

/**
 * Gets the type of a file based on its extension
 * @param {File|String} file - The file object or filename to check
 * @returns {string} - The file type category
 */
export function getFileType(file) {
    if (!file) return 'unknown';

    const extension = (typeof file === 'string' ? file : file.name || '')
        .toLowerCase()
        .split('.')
        .pop();

    const typeMap = {
        // Documents
        'pdf': 'document',
        'doc': 'document',
        'docx': 'document',
        'txt': 'document',
        // Audio
        'mp3': 'audio',
        'wav': 'audio',
        'ogg': 'audio',
        'm4a': 'audio',
        'aac': 'audio',
        'wma': 'audio',
        // Video
        'mp4': 'video',
        'mov': 'video',
        'avi': 'video',
        'mkv': 'video',
        'webm': 'video'
    };

    return typeMap[extension] || 'unknown';
}
