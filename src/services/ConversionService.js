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
    console.log('🔄 Starting conversion:', {
        type: data.type,
        name: data.name,
        contentType: typeof data.content,
        isBuffer: Buffer.isBuffer(data.content),
        contentLength: data.content?.length,
        mimeType: data.mimeType
    });

    try {
      const { type, content, name, apiKey, options, mimeType } = data;
      
      if (!type || !content) {
        throw new Error('Missing required conversion parameters');
      }

      // Handle different content types based on the conversion type
      let processedContent;
      if (['url', 'parenturl', 'youtube'].includes(type.toLowerCase())) {
        // For web-based conversions, pass the content directly
        processedContent = content;
      } else if (['docx', 'pdf', 'doc'].includes(type.toLowerCase())) {
        // For binary files, ensure we have a valid buffer
        if (!Buffer.isBuffer(content)) {
          if (content instanceof Uint8Array) {
            processedContent = Buffer.from(content);
          } else {
            throw new Error(`Invalid content type for ${type}: Expected Buffer or Uint8Array`);
          }
        } else {
          // Create a copy to prevent modifications
          processedContent = Buffer.from(content);
        }

        // Validate file signatures
        const signatures = {
          docx: [0x50, 0x4B, 0x03, 0x04], // PK\x03\x04
          pdf: [0x25, 0x50, 0x44, 0x46],  // %PDF
          doc: [0xD0, 0xCF, 0x11, 0xE0]   // DOC
        };

        const fileSignature = signatures[type.toLowerCase()];
        if (fileSignature && !processedContent.slice(0, 4).equals(Buffer.from(fileSignature))) {
          throw new Error(`Invalid ${type.toUpperCase()} file signature`);
        }
      } else {
        processedContent = content;
      }

      // Log content state for debugging
      console.log('Converting content:', {
        type,
        name,
        contentType: typeof processedContent,
        isBuffer: Buffer.isBuffer(processedContent),
        length: processedContent?.length,
        preview: Buffer.isBuffer(processedContent) 
          ? processedContent.slice(0, 4).toString('hex')
          : typeof processedContent === 'string' 
            ? processedContent.substring(0, 50) 
            : 'N/A'
      });

      // Add PPTX MIME type handling
      if (data.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        data.type = 'pptx';
      }

      const fileType = path.extname(name).slice(1).toLowerCase();
      const category = determineCategory(type, fileType);
      
      // Check if API key is required
      if (this.requiresApiKey(fileType) && !apiKey) {
        throw new Error('API key is required for audio/video conversion');
      }

      const result = await this.converter.convertToMarkdown(
        type,
        processedContent,
        {
          name,
          apiKey,
          mimeType,
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
    } catch (error) {
      console.error('❌ Conversion error:', {
        error: error.message,
        type: data.type,
        name: data.name,
        stack: error.stack
      });
      throw error;
    }
  }

  async convertBatch(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No items provided for batch conversion');
    }

    try {
      console.log('Starting batch conversion of', items.length, 'items');
      
      const results = await Promise.all(
        items.map(async (item) => {
          try {
            if (!item) return null;
            
            const fileType = path.extname(item.name || '').slice(1).toLowerCase();
            const category = determineCategory(item.type, fileType);
            
            console.log(`Converting item: ${item.name} (${item.type})`);

            // Check API key requirement
            if (this.requiresApiKey(item.type) && !item.apiKey) {
              throw new Error(`API key required for ${item.type} conversion`);
            }

            const result = await this.processItem(item);
            return {
              ...result,
              id: item.id,
              category,
              type: item.type,
              name: item.name
            };
          } catch (error) {
            console.error(`Error converting item ${item.name}:`, error);
            return {
              id: item.id,
              name: item.name,
              type: item.type,
              category: 'error',
              success: false,
              error: error.message,
              content: `# Conversion Error\n\nFailed to convert ${item.name}\nError: ${error.message}`
            };
          }
        })
      );

      // Filter out null results
      const validResults = results.filter(Boolean);
      
      // Create zip with all results
      const zipBuffer = await createBatchZip(validResults);
      
      return {
        buffer: zipBuffer,
        filename: this.generateFilename()
      };
    } catch (error) {
      console.error('Batch conversion failed:', error);
      throw error;
    }
  }

  async processItem(item) {
    const { type, content, name, options = {} } = item;
    
    const fileType = path.extname(name).slice(1).toLowerCase();
    const category = determineCategory(type, fileType);
    const converterType = this.getConverterType(type, fileType);

    // Add specific handling for data files (CSV, XLSX)
    if (fileType === 'csv' || fileType === 'xlsx') {
      console.log('Processing data file:', { name, category, type: fileType });
      return this.handleDataFileConversion(fileType, content, name, options);
    }

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
        if (!content) {
            throw new Error(`No content provided for file conversion: ${name}`);
        }

        const result = await this.converter.convertToMarkdown(type, content, {
            name,
            ...options
        });

        const category = determineCategory(type, path.extname(name).slice(1));
        
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

  async handleDataFileConversion(type, content, name, options) {
    try {
      const result = await this.converter.convertToMarkdown(
        type,
        content,
        {
          name,
          ...options
        }
      );

      return {
        ...result,
        success: true,
        type,
        category: 'data',
        name,
        options
      };
    } catch (error) {
      console.error('Data file conversion error:', error);
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
    if (type === 'video' || ['mp4', 'webm', 'avi'].includes(fileType)) {
      return 'video';
    }
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
    return this.isAudioExtension(type) || this.isVideoExtension(type);
  }

  isVideoExtension(ext) {
    return ['mp4', 'webm', 'avi'].includes(ext.toLowerCase());
  }
}
