/**
 * DOCX Converter Adapter
 * 
 * Adapts the backend DOCX converter for use in the Electron main process.
 * Uses the BaseModuleAdapter for consistent module loading and error handling.
 */
const BaseModuleAdapter = require('./BaseModuleAdapter');

// Create the DOCX converter adapter
class DocxConverterAdapter extends BaseModuleAdapter {
  constructor() {
    super(
      'src/services/converter/text/docxConverter.js',
      'default'
    );
  }
  
  /**
   * Convert DOCX to Markdown
   * @param {Buffer} input - DOCX file buffer
   * @param {string} originalName - Original filename
   * @returns {Promise<{content: string, images: Array}>}
   */
  async convertDocxToMarkdown(input, originalName) {
    return this.executeMethod('convert', [input, originalName]);
  }
}

// Create and export a singleton instance
const docxConverterAdapter = new DocxConverterAdapter();

module.exports = {
  convertDocxToMarkdown: (...args) => docxConverterAdapter.convertDocxToMarkdown(...args),
  docxConverterAdapter
};
