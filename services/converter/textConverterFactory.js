// services/converter/textConverterFactory.js

import path from 'path';
// Import all your converters
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
import { convertYoutubeToMarkdown } from './web/youtubeConverter.js';

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
      youtube: convertYoutubeToMarkdown,
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
      // Add other format requirements here
      // Example:
      // html: ['string'],
      // xml: ['string'],
      // url: ['string'],
      // youtube: ['string'],
    };
  }

  /**
   * Validates input type against expected types for the format
   * @private
   * @param {string} type - The file type
   * @param {any} input - The input to validate
   * @throws {Error} If input type is invalid
   */
  validateInput(type, input) {
    const expectedTypes = this.expectedInputTypes[type.toLowerCase()] || ['buffer', 'string'];
    const inputType = typeof input;
    const isBuffer = Buffer.isBuffer(input);

    console.log('Validating input:', {
      fileType: type,
      inputType,
      isBuffer,
      expectedTypes,
      constructorName: input?.constructor?.name
    });

    if (!expectedTypes.includes('buffer') && isBuffer) {
      throw new Error(`${type} converter does not accept Buffer input`);
    }

    if (!expectedTypes.includes(inputType) && !isBuffer) {
      throw new Error(
        `Invalid input type for ${type}. Expected ${expectedTypes.join(' or ')}, got ${inputType}`
      );
    }
  }

  /**
   * Converts input content to Markdown format
   * @param {string} type - The type of content
   * @param {Buffer|string} input - The content to convert
   * @param {string} originalName - Original filename
   * @param {string} [apiKey] - API key for services that require authentication
   * @returns {Promise<{ content: string, images: Array }>} - Converted content and images
   */
  async convertToMarkdown(type, input, originalName, apiKey) {
    try {
      // Input validation
      if (!input) {
        throw new Error('No input provided');
      }

      if (!type) {
        throw new Error('No file type specified');
      }

      const normalizedType = type.toLowerCase();

      // Get the appropriate converter
      const converter = this.converters[normalizedType];
      if (!converter) {
        throw new Error(`Unsupported file type: ${type}`);
      }

      // Validate input type
      this.validateInput(normalizedType, input);

      // Log conversion attempt
      console.log('Attempting conversion:', {
        type: normalizedType,
        inputType: typeof input,
        isBuffer: Buffer.isBuffer(input),
        originalName
      });

      // Perform conversion
      // Pass originalName and apiKey to converter if needed
      const convertedResult = await converter(input, originalName, apiKey);

      // Verify conversion result
      if (!convertedResult || !convertedResult.content) {
        throw new Error('Converter returned empty content');
      }

      // Ensure images array exists
      if (!convertedResult.images) {
        convertedResult.images = [];
      }

      return convertedResult;
    } catch (error) {
      console.error('Conversion error:', {
        type,
        error: error.message,
        stack: error.stack
      });
      throw error;
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
}

// Export singleton instance
export const textConverterFactory = new TextConverterFactory();
