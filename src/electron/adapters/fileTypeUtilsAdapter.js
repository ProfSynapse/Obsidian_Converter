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

// Initialize variables to hold the module functions once loaded
let requiresApiKey = null;
let determineCategory = null;

// Use dynamic import to load the ES module
(async function loadModule() {
  try {
    // Import the ES module
    const module = await import('../../../backend/src/utils/fileTypeUtils.js');
    
    // Store the exported functions
    requiresApiKey = module.requiresApiKey;
    determineCategory = module.determineCategory;
    
    console.log('✅ Successfully loaded fileTypeUtils module');
  } catch (error) {
    console.error('❌ Failed to load fileTypeUtils module:', error);
    
    // Provide fallback implementations to prevent crashes
    requiresApiKey = (fileType) => {
      console.error('Using fallback requiresApiKey function');
      return false;
    };
    
    determineCategory = (type, fileType) => {
      console.error('Using fallback determineCategory function');
      return 'text';
    };
  }
})();

// Export a proxy object that forwards calls to the actual module functions
module.exports = {
  // Getters ensure we return the loaded functions or wait until they're loaded
  get requiresApiKey() {
    if (!requiresApiKey) {
      console.warn('⚠️ Accessing requiresApiKey before it has loaded');
    }
    return requiresApiKey;
  },
  
  get determineCategory() {
    if (!determineCategory) {
      console.warn('⚠️ Accessing determineCategory before it has loaded');
    }
    return determineCategory;
  }
};
