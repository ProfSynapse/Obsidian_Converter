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
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();
    
    console.log('🔄 Starting conversion:', {
        type: data.type,
        name: data.name,
        contentType: typeof data.content,
        isBuffer: Buffer.isBuffer(data.content),
        contentLength: data.content?.length,
        mimeType: data.mimeType,
        initialMemory: {
          heapUsed: Math.round(initialMemory.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(initialMemory.heapTotal / 1024 / 1024) + 'MB'
        }
    });

    // Run garbage collection if available and memory usage is high
    if (global.gc && initialMemory.heapUsed > 0.8 * initialMemory.heapTotal) {
      console.log('🧹 Running initial garbage collection');
      global.gc();
    }

    try {
      const { type, content, name, apiKey, options, mimeType } = data;
      
      if (!type || !content) {
        throw new Error('Missing required conversion parameters');
      }

    // File signatures for supported formats
    const FILE_SIGNATURES = {
      docx: {
        bytes: [0x50, 0x4B, 0x03, 0x04], // PK\x03\x04
        description: 'DOCX/ZIP signature'
      },
      pdf: {
        bytes: [0x25, 0x50, 0x44, 0x46],  // %PDF
        description: 'PDF signature'
      },
      doc: {
        bytes: [0xD0, 0xCF, 0x11, 0xE0],  // DOC
        description: 'DOC signature'
      },
      pptx: {
        bytes: [0x50, 0x4B, 0x03, 0x04], // PK\x03\x04
        description: 'PPTX/ZIP signature'
      }
    };

    // Enhanced content type handling with detailed validation
    let processedContent;
    const normalizedType = type.toLowerCase();

    console.log('🔄 Processing content:', {
      type: normalizedType,
      contentType: typeof content,
      isBuffer: Buffer.isBuffer(content),
      isUint8Array: content instanceof Uint8Array,
      size: content?.length
    });

    if (['url', 'parenturl'].includes(normalizedType)) {
      // Web-based conversions
      console.log('🌐 Processing web content');
      processedContent = content;
    } else if (['docx', 'pdf', 'doc', 'pptx'].includes(normalizedType)) {
      // Binary file handling with enhanced validation
      console.log('📄 Processing document file');
      
      if (!Buffer.isBuffer(content)) {
        if (content instanceof Uint8Array) {
          console.log('🔄 Converting Uint8Array to Buffer');
          processedContent = Buffer.from(content);
        } else {
          console.error('❌ Invalid content type:', typeof content);
          throw new Error(`Invalid content type for ${type}: Expected Buffer or Uint8Array`);
        }
      } else {
        console.log('📦 Creating buffer copy');
        processedContent = Buffer.from(content);
      }

      // Validate file signature
      const fileSignature = FILE_SIGNATURES[normalizedType];
      if (fileSignature) {
        console.log('🔐 Validating file signature:', {
          type: normalizedType,
          expectedSignature: Buffer.from(fileSignature.bytes).toString('hex'),
          actualSignature: processedContent.slice(0, 4).toString('hex'),
          description: fileSignature.description
        });

        if (!processedContent.slice(0, 4).equals(Buffer.from(fileSignature.bytes))) {
          throw new Error(`Invalid ${type.toUpperCase()} file signature: Expected ${fileSignature.description}`);
        }
      }
    } else {
      console.log('📄 Processing generic content');
      processedContent = content;
    }

    // Enhanced content state logging with signature validation
    const logSignatureValidation = () => {
      if (!Buffer.isBuffer(processedContent)) return null;
      
      const signature = processedContent.slice(0, 4).toString('hex');
      const expectedSignature = FILE_SIGNATURES[normalizedType]?.bytes;
      
      return {
        hex: processedContent.slice(0, 8).toString('hex'),
        signature,
        isValidSignature: expectedSignature ? 
          expectedSignature.every((byte, i) => processedContent[i] === byte) : 
          true,
        description: FILE_SIGNATURES[normalizedType]?.description || 'Unknown format'
      };
    };

      console.log('📝 Converting content:', {
        type: normalizedType,
        name,
        contentType: typeof processedContent,
        isBuffer: Buffer.isBuffer(processedContent),
        length: processedContent?.length,
        preview: Buffer.isBuffer(processedContent) 
          ? logSignatureValidation()
          : typeof processedContent === 'string' 
            ? processedContent.substring(0, 50) 
            : 'N/A',
        options: {
          ...options,
          apiKey: options.apiKey ? '***' : undefined // Hide API key in logs
        }
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

      console.log('🔄 Initiating conversion with converter:', {
        type,
        name,
        hasApiKey: !!apiKey,
        mimeType,
        optionsProvided: Object.keys(options || {})
      });

      let result;
      try {
        result = await this.converter.convertToMarkdown(
          type,
          processedContent,
          {
            name,
            apiKey,
            mimeType,
            ...options
          }
        );
      } catch (conversionError) {
        console.error('❌ Conversion error:', {
          error: conversionError.message,
          type,
          name,
          stack: conversionError.stack
        });
        
        // Check for specific error conditions
        if (conversionError.message.includes('timed out')) {
          throw new Error(`Conversion timed out for ${name} - file may be too large or complex`);
        }
        
        if (conversionError.message.includes('memory')) {
          throw new Error(`Memory limit exceeded while converting ${name}`);
        }
        
        throw conversionError;
      }

      if (!result) {
        console.error('❌ No result from converter:', {
          type,
          name,
          mimeType
        });
        throw new Error(`Conversion failed for ${name} - no result returned`);
      }

      if (!result.content) {
        console.error('❌ No content in conversion result:', {
          type,
          name,
          resultKeys: Object.keys(result)
        });
        throw new Error(`Conversion failed for ${name} - no content produced`);
      }

      try {
        // Check memory before ZIP creation
        const preZipMemory = process.memoryUsage();
        if (global.gc && preZipMemory.heapUsed > 0.8 * preZipMemory.heapTotal) {
          console.log('🧹 Running pre-ZIP garbage collection');
          global.gc();
        }

        console.log('📦 Creating ZIP archive:', {
          type: fileType,
          category,
          name,
          contentLength: result.content.length,
          hasImages: result.images?.length > 0,
          imageCount: result.images?.length || 0,
          memory: {
            heapUsed: Math.round(preZipMemory.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(preZipMemory.heapTotal / 1024 / 1024) + 'MB'
          }
        });

        // Check if we can skip ZIP creation (single file without attachments)
        const shouldCreateZip = 
          category === 'web' || // Web scrapes have complex structure
          (result.images && result.images.length > 0) || // Has attachments
          type === 'parenturl'; // Parent URL always creates multiple files

        if (!shouldCreateZip) {
          const baseName = path.basename(name, path.extname(name));
          const endMemory = process.memoryUsage();
          console.log('✅ Single file conversion completed:', {
            type: fileType,
            name,
            duration: Date.now() - startTime + 'ms',
            finalMemory: Math.round(endMemory.heapUsed / 1024 / 1024) + 'MB',
            memoryChange: Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB'
          });

          return {
            buffer: Buffer.from(result.content),
            filename: `${baseName}.md`,
            type: 'markdown'
          };
        } else {
          // Create ZIP for complex conversions
          const zipBuffer = await createBatchZip([{
            ...result,
            type: fileType,
            category,
            name
          }]);

          // Clean up after ZIP creation
          if (global.gc) {
            console.log('🧹 Running post-ZIP garbage collection');
            global.gc();
          }

          const endMemory = process.memoryUsage();
          console.log('✅ ZIP conversion completed:', {
            type: fileType,
            name,
            duration: Date.now() - startTime + 'ms',
            finalMemory: Math.round(endMemory.heapUsed / 1024 / 1024) + 'MB',
            memoryChange: Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB'
          });

          return {
            buffer: zipBuffer,
            filename: this.generateFilename(),
            type: 'zip'
          };
        }
      } catch (zipError) {
        console.error('❌ ZIP creation failed:', {
          error: zipError.message,
          type: fileType,
          name,
          memory: process.memoryUsage(),
          duration: Date.now() - startTime + 'ms'
        });
        throw new Error(`Failed to create ZIP archive for ${name}: ${zipError.message}`);
      }
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
      case 'parenturl':
        return this.handleParentUrlConversion(content, name);
      case 'url':
        return this.handleUrlConversion(content, name);
      default:
        return this.handleFileConversion(converterType, content, name, options);
    }
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
