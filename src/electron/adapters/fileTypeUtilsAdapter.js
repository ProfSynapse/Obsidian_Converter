/**
 * fileTypeUtilsAdapter.js
 * 
 * This adapter provides a CommonJS wrapper around the ES module fileTypeUtils.
 * It allows the Electron code (which uses CommonJS) to import the backend code
 * (which uses ES modules) without compatibility issues.
 * 
 * Related files:
 * - backend/src/utils/fileTypeUtils.js: The original ES module
 * - src/electron/services/ElectronConversionService.js: The consumer of this adapter
 */

// Define fallback functions that will be used until the real ones are loaded
const fallbackRequiresApiKey = (fileType) => {
  console.warn('Using fallback requiresApiKey function');
  return false;
};

const fallbackDetermineCategory = (type, fileType) => {
  console.warn('Using fallback determineCategory function');
  
  // Simple fallback logic based on file extension
  const normalizedType = type?.toLowerCase();
  const normalizedFileType = fileType?.toLowerCase();
  
  // Handle presentation files
  if (normalizedFileType === 'pptx' || normalizedFileType === 'ppt') {
    return 'text';
  }
  
  // Audio types
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(normalizedFileType)) {
    return 'multimedia';
  }
  
  // Video types
  if (['mp4', 'webm', 'avi', 'mov'].includes(normalizedFileType)) {
    return 'multimedia';
  }
  
  // Document types - add pptx explicitly
  if (['pdf', 'docx', 'pptx', 'ppt'].includes(normalizedFileType)) {
    return 'text';
  }
  
  // Data files
  if (['csv', 'xlsx', 'xls'].includes(normalizedFileType)) {
    return 'data';
  }
  
  // Web content
  if (['url', 'parenturl'].includes(normalizedType)) {
    return 'web';
  }
  
  // Default to text for unknown types
  return 'text';
};

// Export the fallback functions directly to ensure they're always available
module.exports = {
  requiresApiKey: fallbackRequiresApiKey,
  determineCategory: fallbackDetermineCategory
};

// Load the real functions asynchronously
(async function loadModule() {
  try {
    // Import the ES module
    const module = await import('../../../backend/src/utils/fileTypeUtils.js');
    
    // Replace the exports with the real functions
    module.exports.requiresApiKey = module.requiresApiKey;
    module.exports.determineCategory = module.determineCategory;
    
    console.log('✅ Successfully loaded fileTypeUtils module');
  } catch (error) {
    console.error('❌ Failed to load fileTypeUtils module:', error);
    // Fallbacks are already in place, so no additional action needed
  }
})();
