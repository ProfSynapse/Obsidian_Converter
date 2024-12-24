// src/lib/utils/iconUtils.js

/**
 * Returns the appropriate icon based on the file type
 * @param {string} type - The file type category
 * @returns {string} The corresponding emoji/icon
 */
export function getFileIcon(type) {
  const icons = {
    document: '📄',
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    url: '🔗',
    parenturl: '🗺️',
    youtube: '🎥',
    default: '📁'
  };
  return icons[type] || icons.default;
}
