/**
 * PDF Converter Adapter
 * 
 * Adapts the backend PDF converter for use in the Electron main process.
 * Uses the BaseModuleAdapter for consistent module loading and error handling.
 * 
 * Related files:
 * - backend/src/services/converter/text/pdfConverter.js: Original implementation
 * - src/electron/services/ElectronConversionService.js: Service using this adapter
 * - src/electron/adapters/BaseModuleAdapter.js: Base adapter class
 */
const BaseModuleAdapter = require('./BaseModuleAdapter');

// Create the PDF converter adapter
class PdfConverterAdapter extends BaseModuleAdapter {
  constructor() {
    super(
      'src/services/converter/text/pdfConverter.js',
      'default'
    );
  }
  
  /**
   * Convert PDF to Markdown
   * @param {Buffer} input - PDF file buffer
   * @param {string} originalName - Original filename
   * @param {string} [apiKey] - Optional API key
   * @returns {Promise<{content: string, images: Array}>}
   */
  async convertPdfToMarkdown(input, originalName, apiKey) {
    console.log(`🔍 [PDFConverter] Starting PDF conversion for: ${originalName}`);
    console.log(`📊 [PDFConverter] Input buffer stats:`, {
      isBuffer: Buffer.isBuffer(input),
      length: input ? input.length : 'null',
      firstBytes: input && Buffer.isBuffer(input) ? input.slice(0, 20).toString('hex') : 'null'
    });
    
    // Validate that input is a buffer
    if (!Buffer.isBuffer(input)) {
      console.error(`❌ [PDFConverter] Input is not a buffer:`, {
        type: typeof input,
        isString: typeof input === 'string',
        length: input ? input.length : 'null'
      });
      throw new Error('Invalid input: PDF conversion requires a buffer');
    }
    
    // Check for PDF signature
    if (input.length >= 5) {
      const signature = input.slice(0, 5).toString();
      console.log(`🔍 [PDFConverter] File signature: ${signature}`);
      if (signature !== '%PDF-') {
        console.warn(`⚠️ [PDFConverter] File does not have PDF signature: ${signature}`);
      }
    } else {
      console.error(`❌ [PDFConverter] Input buffer too small: ${input.length} bytes`);
      throw new Error('Invalid PDF: File too small');
    }
    
    try {
      console.log(`⏳ [PDFConverter] Executing 'convert' method...`);
      const result = await this.executeMethod('convert', [input, originalName, apiKey]);
      
      console.log(`✅ [PDFConverter] Conversion successful:`, {
        hasContent: !!result?.content,
        contentLength: result?.content?.length || 0,
        hasImages: Array.isArray(result?.images),
        imageCount: Array.isArray(result?.images) ? result.images.length : 0
      });
      
      // Validate the result
      if (!result || !result.content || result.content.trim() === '') {
        console.error(`❌ [PDFConverter] Empty conversion result`);
        throw new Error('PDF conversion produced empty content');
      }
      
      return result;
    } catch (error) {
      console.error(`❌ [PDFConverter] Conversion failed:`, error);
      console.error(`🔍 [PDFConverter] Error details:`, {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Rethrow with clear message
      throw new Error(`PDF conversion failed: ${error.message}`);
    }
  }
  
  /**
   * Validate PDF input
   * @param {Buffer} input - PDF file buffer
   * @returns {Promise<boolean>}
   */
  async validatePdfInput(input) {
    console.log(`🔍 [PDFConverter] Validating PDF input`);
    try {
      const result = await this.executeMethod('validate', [input]);
      console.log(`✅ [PDFConverter] Validation result: ${result}`);
      return result;
    } catch (error) {
      console.error(`❌ [PDFConverter] Validation failed:`, error);
      throw new Error(`PDF validation failed: ${error.message}`);
    }
  }
}

// Create and export a singleton instance
const pdfConverterAdapter = new PdfConverterAdapter();

module.exports = {
  convertPdfToMarkdown: (...args) => pdfConverterAdapter.convertPdfToMarkdown(...args),
  validatePdfInput: (...args) => pdfConverterAdapter.validatePdfInput(...args),
  pdfConverterAdapter
};
