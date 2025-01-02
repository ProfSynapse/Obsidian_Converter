import { textConverterFactory } from './converter/textConverterFactory.js';
import { createBatchZip } from '../routes/middleware/utils/zipProcessor.js';  // Fix path
import { determineCategory } from '../utils/fileTypeUtils.js';  // Updated import path
import path from 'path';

export class ConversionService {
  constructor() {
    // Initialize textConverterFactory
    this.converter = textConverterFactory;
  }

  async convert(data) {
    try {
      const { type, content, name, apiKey, options } = data;
      
      if (!type || !content) {
        throw new Error('Missing required conversion parameters');
      }

      // For file uploads
      if (Buffer.isBuffer(content)) {
        const fileType = path.extname(name).slice(1).toLowerCase();
        const category = determineCategory(type, fileType);
        
        // Check if API key is required
        if (this.requiresApiKey(fileType) && !apiKey) {
          throw new Error('API key is required for audio/video conversion');
        }

        const result = await this.converter.convertToMarkdown(
          fileType,
          content,
          {
            name,
            apiKey,
            ...options
          }
        );

        if (!result) {
          throw new Error('Conversion failed - no result returned');
        }

        return {
          buffer: await createBatchZip([{
            ...result,
            type: fileType,
            category,
            name
          }]),
          filename: this.generateFilename()
        };
      }

      // For other types (URL, YouTube, etc.)
      const fileType = path.extname(name).slice(1).toLowerCase();
      const category = determineCategory(type, fileType);
      const converterType = this.getConverterType(type, fileType);

      console.log('Converting file:', {
        type,
        fileType,
        category,
        converterType,
        name
      });

      const result = await textConverterFactory.convertToMarkdown(
        converterType,
        content,
        name,
        apiKey
      );

      if (!result) {
        throw new Error('Conversion failed - no result returned');
      }

      const zipResult = await createBatchZip([{
        ...result,
        type,
        category,
        name,
        options
      }]);

      return {
        buffer: zipResult,
        filename: this.generateFilename()
      };
    } catch (error) {
      console.error('Conversion error:', error);
      throw error;
    }
  }

  async convertBatch(items) {
    const results = await Promise.all(
      items.map(item => this.processItem(item))
    );

    const zipResult = await createBatchZip(results);

    return {
      buffer: zipResult,
      filename: this.generateFilename()
    };
  }

  async processItem(item) {
    const { type, content, name, options = {} } = item;
    
    const fileType = path.extname(name).slice(1).toLowerCase();
    const category = determineCategory(type, fileType);
    const converterType = this.getConverterType(type, fileType);

    switch (type) {
      case 'youtube':
        return this.handleYouTubeConversion(content, name);
      case 'parenturl':
        return this.handleParentUrlConversion(content, name);
      case 'url':
        return this.handleUrlConversion(content, name);
      default:
        return this.handleFileConversion(converterType, content, name, options);
    }
  }

  async handleYouTubeConversion(url, name) {
    const result = await textConverterFactory.convertToMarkdown('youtube', url, name);
    return {
      ...result,
      type: 'youtube',
      category: 'web',
      name
    };
  }

  async handleParentUrlConversion(url, name) {
    const result = await textConverterFactory.convertToMarkdown('parenturl', url, name);
    return {
      ...result,
      type: 'parenturl',
      category: 'web',
      name
    };
  }

  async handleUrlConversion(url, name) {
    const result = await textConverterFactory.convertToMarkdown('url', url, name);
    return {
      ...result,
      type: 'url',
      category: 'web',
      name
    };
  }

  async handleFileConversion(type, content, name, options) {
    try {
      const result = await textConverterFactory.convertToMarkdown(type, content, name);
      const category = determineCategory(type, path.extname(name).slice(1));
      
      // Add additional metadata for conversion result
      return {
        ...result,
        success: true,
        type,
        category,
        name,
        options,
        contentLength: result.content?.length || 0,
        imageCount: result.images?.length || 0
      };
    } catch (error) {
      console.error('File conversion error:', error);
      return {
        success: false,
        error: error.message,
        type,
        name,
        content: `# Conversion Error\n\nFailed to convert ${name}\nError: ${error.message}`
      };
    }
  }

  getConverterType(type, fileType) {
    if (type === 'url') return 'url';
    if (type === 'parenturl') return 'parenturl';
    if (type === 'youtube') return 'youtube';
    return fileType;
  }

  generateFilename() {
    return `conversion_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
  }

  isAudioExtension(ext) {
    return ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'].includes(ext.toLowerCase());
  }

  requiresApiKey(type) {
    return this.isAudioExtension(type);
  }
}
