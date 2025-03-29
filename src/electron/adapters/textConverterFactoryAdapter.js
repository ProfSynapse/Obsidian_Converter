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

// Create a fallback implementation of the textConverterFactory
const fallbackTextConverterFactory = {
  /**
   * Fallback implementation of convertToMarkdown
   * @param {string} type - The type of content
   * @param {Buffer|string|Object} content - The content to convert
   * @param {Object} options - Conversion options
   * @returns {Promise<{ content: string, images: Array }>} - Converted content and images
   */
  convertToMarkdown: async (type, content, options = {}) => {
    console.warn('⚠️ Using fallback textConverterFactory.convertToMarkdown');
    console.log('Conversion request:', { 
      type, 
      contentType: typeof content, 
      isBuffer: Buffer.isBuffer(content),
      contentLength: content ? (Buffer.isBuffer(content) ? content.length : (typeof content === 'string' ? content.length : 'unknown')) : 'null',
      options,
      optionsKeys: Object.keys(options || {})
    });
    
    // Log the first few bytes if it's a buffer to help diagnose format issues
    if (Buffer.isBuffer(content) && content.length > 0) {
      console.log('Content preview (first 20 bytes):', content.slice(0, 20).toString('hex'));
      
      // Check for PDF signature
      if (content.length >= 5 && content.slice(0, 5).toString() === '%PDF-') {
        console.log('Content appears to be a valid PDF (has %PDF- signature)');
      } else {
        console.log('Content does not have a PDF signature');
      }
    }
    
    // Create a simple markdown representation based on the file type
    const fileName = options.name || 'unknown';
    const timestamp = new Date().toISOString();
    
    // Basic markdown content with file info
    const markdown = [
      '---',
      `title: ${fileName}`,
      `date: ${timestamp}`,
      `type: ${type}`,
      '---',
      '',
      `# ${fileName}`,
      '',
      '> This file was processed by the fallback converter while the main converter was loading.',
      '> Please try again in a moment.',
      '',
      '## File Information',
      '',
      `- **File Type**: ${type}`,
      `- **Processed**: ${timestamp}`,
      `- **Size**: ${Buffer.isBuffer(content) ? content.length : (typeof content === 'string' ? content.length : 'unknown')} bytes`,
      '',
      '## Content Preview',
      '',
      '```',
      Buffer.isBuffer(content) 
        ? 'Binary content (not displayed)'
        : (typeof content === 'string' 
            ? content.substring(0, 100) + (content.length > 100 ? '...' : '')
            : 'Content not available'),
      '```'
    ].join('\n');
    
    console.log('Fallback conversion complete for:', fileName);
    
    return {
      content: markdown,
      images: [],
      success: true
    };
  },
  
  /**
   * Fallback implementation of validateInput
   */
  validateInput: (type, input) => {
    console.warn('⚠️ Using fallback textConverterFactory.validateInput');
    console.log('Validating input:', { 
      type, 
      inputType: typeof input,
      isBuffer: Buffer.isBuffer(input),
      inputLength: input ? (Buffer.isBuffer(input) ? input.length : (typeof input === 'string' ? input.length : 'unknown')) : 'null'
    });
    return true; // Always pass validation in fallback mode
  },
  
  /**
   * Fallback implementation of validateFileSignature
   */
  validateFileSignature: (type, buffer) => {
    console.warn('⚠️ Using fallback textConverterFactory.validateFileSignature');
    console.log('Validating file signature:', { 
      type, 
      isBuffer: Buffer.isBuffer(buffer),
      bufferLength: buffer ? (Buffer.isBuffer(buffer) ? buffer.length : 'not a buffer') : 'null'
    });
    return true; // Always pass validation in fallback mode
  }
};

// Export the fallback implementation directly
const exportedFactory = { textConverterFactory: fallbackTextConverterFactory };

// Use dynamic import to load the ES module
(async function loadModule() {
  try {
    console.log('🔄 Attempting to load textConverterFactory module...');
    
    // Import the ES module
    const module = await import('../../../backend/src/services/converter/textConverterFactory.js');
    
    console.log('📦 Module import result:', {
      hasTextConverterFactory: !!module.textConverterFactory,
      moduleKeys: Object.keys(module),
      isObject: typeof module === 'object',
      isNull: module === null
    });
    
    // Replace the fallback with the real implementation
    if (module.textConverterFactory) {
      console.log('🔍 Real textConverterFactory found, checking methods:', {
        hasConvertToMarkdown: typeof module.textConverterFactory.convertToMarkdown === 'function',
        hasValidateInput: typeof module.textConverterFactory.validateInput === 'function',
        hasValidateFileSignature: typeof module.textConverterFactory.validateFileSignature === 'function'
      });
      
      exportedFactory.textConverterFactory = module.textConverterFactory;
      console.log('✅ Successfully loaded textConverterFactory module');
    } else {
      console.error('❌ Module loaded but textConverterFactory property is missing');
    }
  } catch (error) {
    console.error('❌ Failed to load textConverterFactory module:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    // Fallback is already in place, so no additional action needed
  }
})();

// Export the factory object
module.exports = exportedFactory;
