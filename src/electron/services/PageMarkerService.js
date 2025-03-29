/**
 * PageMarkerService.js
 * 
 * Provides utilities for adding page markers to converted content.
 * Handles different document types and formats page markers consistently.
 * 
 * Related files:
 * - src/electron/adapters/pdfConverterAdapter.js: Uses this service for PDF page markers
 * - src/electron/adapters/docxConverterAdapter.js: Uses this service for DOCX page markers
 * - src/electron/adapters/pptxConverterAdapter.js: Uses this service for PPTX slide markers
 * - src/electron/adapters/audioConverterAdapter.js: Uses this service for audio word-based page markers
 * - src/electron/adapters/videoConverterAdapter.js: Uses this service for video word-based page markers
 * - src/electron/adapters/parentUrlConverterAdapter.js: Uses this service for parent URL page markers
 */

class PageMarkerService {
  /**
   * Format a page marker
   * @param {number} pageNumber - The page number
   * @param {string} [url] - Optional URL for parent URL pages
   * @param {string} [markerType='Page'] - Type of marker ('Page' or 'Slide')
   * @returns {string} Formatted page marker
   */
  static formatPageMarker(pageNumber, url = null, markerType = 'Page') {
    if (url) {
      return `\n\n[${markerType} ${pageNumber}: ${url}]\n\n`;
    }
    return `\n\n[${markerType} ${pageNumber}]\n\n`;
  }
  
  /**
   * Insert page markers into content
   * @param {string} content - The content to process
   * @param {Array<{pageNumber: number, position: number, url?: string}>} pageBreaks - Array of page break positions
   * @param {string} [markerType='Page'] - Type of marker ('Page' or 'Slide')
   * @returns {string} Content with page markers
   */
  static insertPageMarkers(content, pageBreaks, markerType = 'Page') {
    // Sort page breaks by position (descending)
    const sortedBreaks = [...pageBreaks].sort((a, b) => b.position - a.position);
    
    // Insert markers from end to beginning to avoid position shifts
    let result = content;
    for (const {pageNumber, position, url} of sortedBreaks) {
      const marker = this.formatPageMarker(pageNumber, url, markerType);
      result = result.slice(0, position) + marker + result.slice(position);
    }
    
    return result;
  }
  
  /**
   * Calculate page breaks based on word count
   * @param {string} content - The content to process
   * @param {number} wordsPerPage - Words per page (default: 275)
   * @returns {Array<{pageNumber: number, position: number}>} Page break positions
   */
  static calculateWordBasedPageBreaks(content, wordsPerPage = 275) {
    const pageBreaks = [];
    const paragraphs = content.split(/\n\n+/);
    
    let wordCount = 0;
    let position = 0;
    let pageNumber = 1;
    
    for (const paragraph of paragraphs) {
      const paragraphWords = paragraph.trim().split(/\s+/).length;
      wordCount += paragraphWords;
      
      // If we've exceeded the words per page threshold
      if (wordCount >= wordsPerPage) {
        // Add a page break after this paragraph
        position += paragraph.length;
        pageNumber++;
        pageBreaks.push({ pageNumber, position });
        wordCount = 0;
      }
      
      position += paragraph.length + 2; // +2 for paragraph break
    }
    
    return pageBreaks;
  }
  
  /**
   * Add page count to metadata
   * @param {Object} metadata - The metadata object
   * @param {number} pageCount - The total page count
   * @returns {Object} Updated metadata
   */
  static addPageMetadata(metadata, pageCount) {
    return {
      ...metadata,
      pageCount
    };
  }
  
  /**
   * Add slide count to metadata
   * @param {Object} metadata - The metadata object
   * @param {number} slideCount - The total slide count
   * @returns {Object} Updated metadata
   */
  static addSlideMetadata(metadata, slideCount) {
    return {
      ...metadata,
      slideCount
    };
  }
}

module.exports = PageMarkerService;
