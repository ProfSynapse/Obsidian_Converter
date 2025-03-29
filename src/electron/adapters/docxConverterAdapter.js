/**
 * DOCX Converter Adapter
 * 
 * Adapts the backend DOCX converter for use in the Electron main process.
 * Uses the BaseModuleAdapter for consistent module loading and error handling.
 * Adds page number markers to the converted content.
 * 
 * Related files:
 * - backend/src/services/converter/text/docxConverter.js: Original implementation
 * - src/electron/services/ElectronConversionService.js: Service using this adapter
 * - src/electron/adapters/BaseModuleAdapter.js: Base adapter class
 * - src/electron/services/PageMarkerService.js: Service for adding page markers
 */
const BaseModuleAdapter = require('./BaseModuleAdapter');
const PageMarkerService = require('../services/PageMarkerService');

// Create the DOCX converter adapter
class DocxConverterAdapter extends BaseModuleAdapter {
  constructor() {
    super(
      'src/services/converter/text/docxConverter.js',
      'default'
    );
  }
  
  /**
   * Convert DOCX to Markdown with page markers
   * @param {Buffer} input - DOCX file buffer
   * @param {string} originalName - Original filename
   * @returns {Promise<{content: string, images: Array, pageCount: number}>}
   */
  async convertDocxToMarkdown(input, originalName) {
    try {
      console.log(`📝 [DOCXConverter] Starting DOCX conversion for: ${originalName}`);
      
      // Call the backend converter with a flag to preserve page information
      const result = await this.executeMethod('convert', [
        input, 
        originalName,
        { preservePageInfo: true } // New option to preserve page info
      ]);
      
      console.log(`✅ [DOCXConverter] Conversion successful:`, {
        hasContent: !!result?.content,
        contentLength: result?.content?.length || 0,
        hasImages: Array.isArray(result?.images),
        imageCount: Array.isArray(result?.images) ? result.images.length : 0,
        hasPageBreaks: Array.isArray(result?.pageBreaks),
        pageBreakCount: Array.isArray(result?.pageBreaks) ? result.pageBreaks.length : 0
      });
      
      // Validate the result
      if (!result || !result.content || result.content.trim() === '') {
        console.error(`❌ [DOCXConverter] Empty conversion result`);
        throw new Error('DOCX conversion produced empty content');
      }
      
      // Process the result to add page markers
      if (result.pageBreaks && result.pageBreaks.length > 0) {
        // Insert page markers into content
        result.content = PageMarkerService.insertPageMarkers(
          result.content, 
          result.pageBreaks
        );
        
        // Add page count to metadata
        result.pageCount = result.pageBreaks.length + 1;
        
        console.log(`📄 [DOCXConverter] Added ${result.pageCount} page markers from DOCX structure`);
      } else {
        console.log(`ℹ️ [DOCXConverter] No page breaks detected, using word-based pagination`);
        
        // Fall back to word-based pagination if no page breaks were detected
        const pageBreaks = PageMarkerService.calculateWordBasedPageBreaks(result.content);
        
        if (pageBreaks.length > 0) {
          result.content = PageMarkerService.insertPageMarkers(result.content, pageBreaks);
          result.pageCount = pageBreaks.length + 1;
          console.log(`📄 [DOCXConverter] Added ${result.pageCount} word-based page markers`);
        } else {
          // Single page document
          result.pageCount = 1;
          console.log(`📄 [DOCXConverter] Document appears to be a single page`);
        }
      }
      
      return result;
    } catch (error) {
      console.error(`❌ [DOCXConverter] Conversion failed:`, error);
      throw new Error(`DOCX conversion failed: ${error.message}`);
    }
  }
}

// Create and export a singleton instance
const docxConverterAdapter = new DocxConverterAdapter();

module.exports = {
  convertDocxToMarkdown: (...args) => docxConverterAdapter.convertDocxToMarkdown(...args),
  docxConverterAdapter
};
