/**
 * textConverterFactoryAdapter.js
 * 
 * This adapter provides a CommonJS wrapper around the ES module textConverterFactory.
 * It allows the Electron code (which uses CommonJS) to import the backend code
 * (which uses ES modules) without compatibility issues.
 * 
 * Related files:
 * - backend/src/services/converter/textConverterFactory.js: The original ES module
 * - src/electron/services/ElectronConversionService.js: The consumer of this adapter
 */

// Initialize variable to hold the module once loaded
let textConverterFactory = null;

// Use dynamic import to load the ES module
(async function loadModule() {
  try {
    // Import the ES module
    const module = await import('../../../backend/src/services/converter/textConverterFactory.js');
    
    // Store the exported object
    textConverterFactory = module.textConverterFactory;
    
    console.log('✅ Successfully loaded textConverterFactory module');
  } catch (error) {
    console.error('❌ Failed to load textConverterFactory module:', error);
    
    // Provide a fallback implementation to prevent crashes
    textConverterFactory = {
      convertToMarkdown: async () => {
        throw new Error('TextConverterFactory module failed to load. See console for details.');
      }
    };
  }
})();

// Export a proxy object that forwards calls to the actual module
module.exports = {
  // Getter ensures we return the loaded module or wait until it's loaded
  get textConverterFactory() {
    if (!textConverterFactory) {
      console.warn('⚠️ Accessing textConverterFactory before it has loaded');
    }
    return textConverterFactory;
  }
};
