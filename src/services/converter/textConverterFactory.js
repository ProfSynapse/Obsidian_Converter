// services/converter/textConverterFactory.js

import { convertPdfToMarkdown } from './text/pdfConverter.js';
import { convertDocxToMarkdown } from './text/docxConverter.js';
import { convertPptxToMarkdown } from './text/pptxConverter.js';
import { convertCsvToMarkdown } from './data/csvConverter.js';
import { convertXlsxToMarkdown } from './data/xlsxConverter.js';
import { convertUrlToMarkdown } from './web/urlConverter.js';
import { convertParentUrlToMarkdown } from './web/parentUrlConverter.js';
import { convertYoutubeToMarkdown } from './web/youtubeConverter.js';
import { convertAudioToMarkdown } from './multimedia/audioconverter.js';
import { convertVideoToMarkdown } from './multimedia/videoConverter.js';

/**
 * Factory class for managing different types of Markdown converters
 */
class TextConverterFactory {
  /**
   * Initialize the converter factory with supported file type mappings
   */
  constructor() {
    this.converters = {
      // Text converters
      pdf: convertPdfToMarkdown,
      docx: convertDocxToMarkdown,
      pptx: convertPptxToMarkdown,

      // Data converters
      csv: convertCsvToMarkdown,
      xlsx: convertXlsxToMarkdown,

      // Web converters
      url: convertUrlToMarkdown,
      parenturl: convertParentUrlToMarkdown,
      youtube: convertYoutubeToMarkdown,
    };

    // Map of expected input types for validation
    this.expectedInputTypes = {
      docx: ['buffer'],
      pdf: ['buffer'],
      pptx: ['buffer'],
      url: ['string'],
      parenturl: ['string', 'object'],
      youtube: ['string'],
    };

    console.log('Registered converters:', Object.keys(this.converters));
    console.log('Registered input types:', this.expectedInputTypes);
  }

  /**
   * Validates input type against expected types for the format
   * @private
   * @param {string} type - The file type
   * @param {any} input - The input to validate
   * @throws {Error} If input type is invalid
   */
  validateInput(type, input) {
    // Normalize type to lowercase
    const normalizedType = type.toLowerCase();

    // Special handling for docx files
    if (normalizedType === 'docx' && Buffer.isBuffer(input)) {
      // Check if buffer starts with PK (ZIP file magic number, which DOCX files should have)
      if (input[0] === 0x50 && input[1] === 0x4B) {
        return true;
      }
      throw new Error('Invalid DOCX file format');
    }

    // Add specific validation for PPTX
    if (normalizedType === 'pptx' && Buffer.isBuffer(input)) {
      // Check for ZIP/PPTX file signature (PK)
      if (input[0] === 0x50 && input[1] === 0x4B) {
        return true;
      }
      throw new Error('Invalid PPTX file format');
    }

    console.log('Validating input:', {
      originalType: type,
      normalizedType,
      inputType: typeof input,
      isBuffer: Buffer.isBuffer(input),
      expectedTypes: this.expectedInputTypes[normalizedType],
      input: Buffer.isBuffer(input)
        ? '[Buffer data]'
        : typeof input === 'object'
        ? JSON.stringify(input)
        : input
    });

    const expectedTypes = this.expectedInputTypes[normalizedType] || ['buffer', 'string'];
    const inputType = typeof input;
    const isBuffer = Buffer.isBuffer(input);

    // Special handling for parenturl type
    if (normalizedType === 'parenturl') {
      if (typeof input === 'string' || typeof input === 'object') {
        return true;
      }
    }

    if (isBuffer && !expectedTypes.includes('buffer')) {
      throw new Error(`${type} converter does not accept Buffer input`);
    }

    if (!expectedTypes.includes(inputType) && !isBuffer) {
      throw new Error(
        `Invalid input type for ${type}. Expected ${expectedTypes.join(' or ')}, got ${inputType}`
      );
    }
  }

  /**
   * Validates buffer content against expected file signatures
   * @param {Buffer} buffer - The buffer to validate
   * @param {string} type - The file type
   * @returns {boolean} - True if buffer is valid, false otherwise
   */
  validateBuffer(buffer, type) {
    console.log('🔍 Validating buffer:', {
      type,
      length: buffer?.length,
      head: buffer?.slice(0, 4).toString('hex')
    });

    if (!Buffer.isBuffer(buffer)) {
      console.error('❌ Invalid buffer type:', typeof buffer);
      return false;
    }

    const signatures = {
      docx: [0x50, 0x4B, 0x03, 0x04],
      pdf: [0x25, 0x50, 0x44, 0x46]
    };

    const sig = signatures[type.toLowerCase()];
    if (!sig) return true;

    const isValid = buffer.slice(0, sig.length).equals(Buffer.from(sig));
    console.log(`📝 Signature check (${type}):`, isValid);
    return isValid;
  }

  /**
   * Converts input content to Markdown format
   * @param {string} type - The type of content
   * @param {Buffer|string|Object} input - The content to convert
   * @param {string} originalName - Original filename or identifier
   * @param {string} [apiKey] - API key for services that require authentication
   * @returns {Promise<{ content: string, images: Array }>} - Converted content and images
   */
  async convertToMarkdown(type, content, options = {}) {
    console.log('🔄 Starting conversion:', {
      type,
      contentType: typeof content,
      isBuffer: Buffer.isBuffer(content),
      options: Object.keys(options)
    });

    // Validate buffer for binary files
    if (['docx', 'pdf', 'pptx'].includes(type)) {
      if (!Buffer.isBuffer(content)) {
        console.error('❌ Invalid content type:', {
          expected: 'Buffer',
          received: typeof content,
          type: type
        });
        throw new Error(`Invalid content for ${type}: Expected Buffer`);
      }

      // Log buffer validation
      console.log('🔍 Validating buffer:', {
        type,
        length: content.length,
        signature: content.slice(0, 4).toString('hex'),
        isValid: this.validateFileSignature(type, content)
      });
    }

    // Normalize type to lowercase
    const fileType = type.toLowerCase();

    // Validate buffer for binary files
    if (['docx', 'pdf', 'pptx'].includes(fileType)) {
      if (!Buffer.isBuffer(content)) {
        throw new Error(`Invalid content for ${fileType}: Expected Buffer`);
      }
      
      // Check file signatures
      const signatures = {
        docx: [0x50, 0x4B, 0x03, 0x04], // PK\x03\x04
        pdf: [0x25, 0x50, 0x44, 0x46],  // %PDF
        pptx: [0x50, 0x4B, 0x03, 0x04]  // PK\x03\x04 (same as docx)
      };

      const fileSignature = signatures[fileType];
      const contentSignature = content.slice(0, 4);
      
      console.log('File signature check:', {
        expected: fileSignature?.map(b => b.toString(16)).join(''),
        received: contentSignature.toString('hex'),
        matches: fileSignature?.every((byte, i) => contentSignature[i] === byte)
      });

      if (!fileSignature?.every((byte, i) => contentSignature[i] === byte)) {
        throw new Error(`Invalid ${fileType.toUpperCase()} file signature`);
      }
    }

    // Route to correct converter
    switch (fileType) {
      case 'docx':
        return await convertDocxToMarkdown(content, options.name);
      case 'pdf':
        return await convertPdfToMarkdown(content, options.name);
      // ...existing cases...
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * Registers a new converter for a file type
   * @param {string} type - The file type
   * @param {Function} converterFunction - The converter function
   */
  addConverter(type, converterFunction) {
    if (typeof converterFunction !== 'function') {
      throw new Error('Converter must be a function');
    }
    this.converters[type.toLowerCase()] = converterFunction;
  }

  /**
   * Checks if the file type is an audio type
   * @param {string} type - The file type
   * @returns {boolean} - True if the file type is an audio type, false otherwise
   */
  isAudioType(type) {
    const audioTypes = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];
    return audioTypes.includes(type.toLowerCase());
  }
}

// Export singleton instance
export const textConverterFactory = new TextConverterFactory();
