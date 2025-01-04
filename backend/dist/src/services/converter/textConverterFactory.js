// services/converter/textConverterFactory.js

import { convertTxtToMarkdown } from './text/txtConverter.js';
import { convertRtfToMarkdown } from './text/rtfConverter.js';
import { convertPdfToMarkdown } from './text/pdfConverter.js';
import { convertDocxToMarkdown } from './text/docxConverter.js';
import { convertOdtToMarkdown } from './text/odtConverter.js';
import { convertEpubToMarkdown } from './text/epubConverter.js';
import { convertPptxToMarkdown } from './text/pptxConverter.js';
import { convertCsvToMarkdown } from './data/csvConverter.js';
import { convertJsonToMarkdown } from './data/jsonConverter.js';
import { convertYamlToMarkdown } from './data/yamlConverter.js';
import { convertXlsxToMarkdown } from './data/xlsxConverter.js';
import { convertHtmlToMarkdown } from './web/htmlConverter.js';
import { convertXmlToMarkdown } from './web/xmlConverter.js';
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
      txt: convertTxtToMarkdown,
      rtf: convertRtfToMarkdown,
      pdf: convertPdfToMarkdown,
      docx: convertDocxToMarkdown,
      odt: convertOdtToMarkdown,
      epub: convertEpubToMarkdown,
      pptx: convertPptxToMarkdown,
      // Data converters
      csv: convertCsvToMarkdown,
      json: convertJsonToMarkdown,
      yaml: convertYamlToMarkdown,
      yml: convertYamlToMarkdown,
      xlsx: convertXlsxToMarkdown,
      // Web converters
      html: convertHtmlToMarkdown,
      htm: convertHtmlToMarkdown,
      xml: convertXmlToMarkdown,
      url: convertUrlToMarkdown,
      parenturl: convertParentUrlToMarkdown,
      youtube: convertYoutubeToMarkdown
    };

    // Map of expected input types for validation
    this.expectedInputTypes = {
      docx: ['buffer'],
      pdf: ['buffer'],
      txt: ['string', 'buffer'],
      rtf: ['buffer'],
      epub: ['buffer'],
      odt: ['buffer'],
      pptx: ['buffer'],
      html: ['string'],
      htm: ['string'],
      xml: ['string'],
      url: ['string'],
      parenturl: ['string', 'object'],
      youtube: ['string']
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
      input: Buffer.isBuffer(input) ? '[Buffer data]' : typeof input === 'object' ? JSON.stringify(input) : input
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
      throw new Error(`Invalid input type for ${type}. Expected ${expectedTypes.join(' or ')}, got ${inputType}`);
    }
  }

  /**
   * Converts input content to Markdown format
   * @param {string} type - The type of content
   * @param {Buffer|string|Object} input - The content to convert
   * @param {string} originalName - Original filename or identifier
   * @param {string} [apiKey] - API key for services that require authentication
   * @returns {Promise<{ content: string, images: Array }>} - Converted content and images
   */
  async convertToMarkdown(type, input, options = {}) {
    try {
      console.log('Converting to Markdown:', {
        type,
        inputType: typeof input,
        hasInput: !!input,
        isBuffer: Buffer.isBuffer(input),
        options
      });
      if (!input) {
        throw new Error('No input provided');
      }
      if (!type) {
        throw new Error('No file type specified');
      }
      const normalizedType = type.toLowerCase();
      const converter = this.converters[normalizedType];
      if (!converter) {
        switch (normalizedType) {
          case 'video':
          case 'mp4':
          case 'webm':
          case 'avi':
            return await convertVideoToMarkdown(input, options);
          default:
            throw new Error(`Unsupported file type: ${type}`);
        }
      }

      // Validate input type
      this.validateInput(normalizedType, input);

      // Call converter with proper parameters
      return await converter(input, options.name || 'Untitled', options.apiKey);
    } catch (error) {
      console.error('Conversion error:', {
        type,
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        content: [`# Conversion Error: ${type}`, '', '```', `Error: ${error.message}`, '```', '', `**Time:** ${new Date().toISOString()}`, `**Type:** ${type}`].join('\n'),
        images: [],
        error: error.message
      };
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