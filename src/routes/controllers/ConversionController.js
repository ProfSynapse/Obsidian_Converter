import { ConversionService } from "../../services/ConversionService.js";
import { AppError } from '../../utils/errorHandler.js';
import path from 'path';
import { randomUUID } from 'crypto';

export class ConversionController {
  constructor() {
    this.conversionService = new ConversionService();
  }

  handleConversion = async (req, res, next) => {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    try {
      const file = req.file;
      const options = JSON.parse(req.body.options || '{}');

      console.log('🚀 Starting file conversion:', {
        fileName: file.originalname,
        size: file.buffer.length,
        initialMemory: Math.round(initialMemory.heapUsed / 1024 / 1024) + 'MB'
      });
      
      // Run garbage collection if available and memory usage is high
      if (global.gc && initialMemory.heapUsed > 512 * 1024 * 1024) {
        console.log('🧹 Running initial garbage collection');
        global.gc();
      }
      
      // Add API key from headers
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      if (apiKey) {
        options.apiKey = apiKey;
      }

      // Create a fresh buffer copy and validate file type
      const fileBuffer = Buffer.from(file.buffer);
      const fileExtension = path.extname(file.originalname).slice(1).toLowerCase();
      const fileType = this.#determineFileType(fileExtension, file.mimetype);

      console.log('🔄 Processing conversion:', {
        fileName: file.originalname,
        fileType: fileType,
        mimeType: file.mimetype,
        hasApiKey: !!apiKey,
        size: fileBuffer.length,
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
      });

      const conversionData = {
        type: fileType,
        content: fileBuffer,
        name: file.originalname,
        options: {
          ...options,
          originalMimeType: file.mimetype,
          streamProcessing: true, // Enable streaming processing
          memoryLimit: 512 * 1024 * 1024, // 512MB memory limit
          chunkSize: file.buffer.length > 50 * 1024 * 1024 ? 25 * 1024 * 1024 : undefined // 25MB chunks for large files
        },
        mimeType: file.mimetype
      };

      const result = await this.conversionService.convert(conversionData);
      
      if (!result.buffer || !result.filename) {
        throw new Error('Invalid conversion result');
      }

      const endMemory = process.memoryUsage();
      console.log('✅ File conversion completed:', {
        fileName: file.originalname,
        duration: Math.round((Date.now() - startTime)/1000) + 's',
        memoryUsed: Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB',
        finalMemory: Math.round(endMemory.heapUsed / 1024 / 1024) + 'MB'
      });

      // Send response (handles both markdown and zip)
      this.#sendZipResponse(res, result);
    } catch (error) {
      console.error('❌ File conversion failed:', {
        error: error.message,
        duration: Math.round((Date.now() - startTime)/1000) + 's',
        memoryUsed: Math.round((process.memoryUsage().heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB'
      });
      next(new AppError(error.message, 500));
    }
  };

    handleBatchConversion = async (req, res, next) => {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    try {
        const files = req.files || {};
        const items = JSON.parse(req.body.items || '[]');
        
        // Get files from both single and batch fields
        const allFiles = [
            ...(files.file || []),
            ...(files.files || [])
        ];
        
        console.log('🎯 Starting batch conversion:', {
            totalFiles: allFiles.length,
            itemsCount: items.length,
            fileNames: allFiles.map(f => f.originalname),
            initialMemory: Math.round(initialMemory.heapUsed / 1024 / 1024) + 'MB'
        });

        // Run initial garbage collection if memory usage is high
        if (global.gc && initialMemory.heapUsed > 512 * 1024 * 1024) {
            console.log('🧹 Running initial garbage collection');
            global.gc();
        }
        
        // Process file uploads with proper content handling
        const fileItems = allFiles.map(file => {
            const fileType = this.#determineFileType(path.extname(file.originalname).slice(1), file.mimetype);
            console.log('🎲 Processing file item:', {
                filename: file.originalname,
                determinedType: fileType,
                mimeType: file.mimetype,
                size: file.buffer.length
            });
            
            return {
                id: randomUUID(),
                type: fileType,
                content: file.buffer,
                name: file.originalname,
                mimeType: file.mimetype,
                options: {
                    includeImages: true,
                    includeMeta: true,
                    convertLinks: true,
                    originalMimeType: file.mimetype
                }
            };
        });

        // Process URL items with proper content
        const urlItems = items.map(item => {
            console.log('🌐 Processing URL item:', {
                url: item.url,
                type: item.type,
                hasOptions: !!item.options
            });
            
            return {
                id: randomUUID(),
                ...item,
                content: item.url,
                type: item.type.toLowerCase(),
                options: {
                    includeImages: true,
                    includeMeta: true,
                    convertLinks: true,
                    ...item.options
                }
            };
        });

        // Combine all items with memory-optimized options
        const allItems = [...fileItems, ...urlItems].map(item => ({
            ...item,
            options: {
                ...item.options,
                chunkSize: 50, // Process in chunks of 50
                memoryLimit: 512 * 1024 * 1024, // 512MB memory limit
                streamProcessing: true
            }
        }));

        console.log('📦 Starting batch processing:', {
            totalItems: allItems.length,
            fileItems: fileItems.length,
            urlItems: urlItems.length,
            memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
        });

        const result = await this.conversionService.convertBatch(allItems);

        const endMemory = process.memoryUsage();
        console.log('✅ Batch conversion completed:', {
            totalItems: allItems.length,
            duration: Math.round((Date.now() - startTime)/1000) + 's',
            memoryUsed: Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB',
            finalMemory: Math.round(endMemory.heapUsed / 1024 / 1024) + 'MB'
        });

        this.#sendZipResponse(res, result);

    } catch (error) {
        console.error('❌ Batch conversion failed:', {
            error: error.message,
            duration: Math.round((Date.now() - startTime)/1000) + 's',
            memoryUsed: Math.round((process.memoryUsage().heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB'
        });
        next(new AppError(
            error.message || 'Failed to process batch conversion',
            error.statusCode || 500
        ));
    }
  };

  handleUrlConversion = async (req, res, next) => {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    try {
      console.log('🌐 Starting URL conversion:', {
        url: req.body.url,
        initialMemory: Math.round(initialMemory.heapUsed / 1024 / 1024) + 'MB'
      });

      // Run garbage collection if available and memory usage is high
      if (global.gc && initialMemory.heapUsed > 512 * 1024 * 1024) {
        console.log('🧹 Running initial garbage collection');
        global.gc();
      }

      const data = {
        type: 'url',
        content: req.body.url,
        name: new URL(req.body.url).hostname,
        options: {
          ...req.body.options,
          streamProcessing: true, // Enable streaming processing
          memoryLimit: 512 * 1024 * 1024 // 512MB memory limit
        }
      };
      
      const result = await this.conversionService.convert(data);

      const endMemory = process.memoryUsage();
      console.log('✅ URL conversion completed:', {
        url: req.body.url,
        duration: Math.round((Date.now() - startTime)/1000) + 's',
        memoryUsed: Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB',
        finalMemory: Math.round(endMemory.heapUsed / 1024 / 1024) + 'MB'
      });

      this.#sendZipResponse(res, result);
    } catch (error) {
      console.error('❌ URL conversion failed:', {
        url: req.body.url,
        error: error.message,
        duration: Math.round((Date.now() - startTime)/1000) + 's',
        memoryUsed: Math.round((process.memoryUsage().heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB'
      });
      next(new AppError(error.message, 500));
    }
  };

  handleParentUrlConversion = async (req, res, next) => {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    try {
      console.log('🚀 Starting parent URL conversion:', {
        url: req.body.parenturl,
        initialMemory: Math.round(initialMemory.heapUsed / 1024 / 1024) + 'MB'
      });

      // Run garbage collection if available
      if (global.gc && initialMemory.heapUsed > 512 * 1024 * 1024) {
        console.log('🧹 Running initial garbage collection');
        global.gc();
      }

      const data = {
        type: 'parenturl',
        content: req.body.parenturl,
        name: new URL(req.body.parenturl).hostname,
        options: {
          ...req.body.options,
          chunkSize: 50, // Process URLs in chunks of 50
          memoryLimit: 512 * 1024 * 1024 // 512MB memory limit
        }
      };
      
      const result = await this.conversionService.convert(data);

      const endMemory = process.memoryUsage();
      console.log('✅ Parent URL conversion completed:', {
        url: req.body.parenturl,
        duration: Math.round((Date.now() - startTime)/1000) + 's',
        memoryUsed: Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB',
        finalMemory: Math.round(endMemory.heapUsed / 1024 / 1024) + 'MB'
      });

      this.#sendZipResponse(res, result);
    } catch (error) {
      console.error('❌ Parent URL conversion failed:', {
        url: req.body.parenturl,
        error: error.message,
        duration: Math.round((Date.now() - startTime)/1000) + 's',
        memoryUsed: Math.round((process.memoryUsage().heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB'
      });

      next(new AppError(error.message, 500));
    }
  };

    handleFileConversion = async (req, res, next) => {
        try {
            // Enhanced request logging with file signature info
            const fileSignature = req.file?.buffer?.slice(0, 4).toString('hex');
            console.log('📝 File conversion request:', {
                headers: {
                    'content-type': req.headers['content-type'],
                    'content-length': req.headers['content-length'],
                    'authorization': req.headers['authorization'] ? 'present' : 'missing'
                },
                body: {
                    hasOptions: !!req.body?.options,
                    optionsType: typeof req.body?.options,
                    parsedOptions: req.body?.options ? JSON.parse(req.body.options) : {}
                },
                file: req.file ? {
                    fieldname: req.file.fieldname,
                    originalname: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.buffer?.length,
                    encoding: req.file.encoding,
                    signature: fileSignature,
                    extension: path.extname(req.file.originalname).slice(1).toLowerCase()
                } : null,
                isMultipart: req.headers['content-type']?.includes('multipart/form-data')
            });

            // Validate request format
            if (!req.headers['content-type']?.includes('multipart/form-data')) {
                throw new AppError('Request must be multipart/form-data', 400);
            }

            // Validate file presence
            if (!req.file) {
                throw new AppError('No file provided in the request. Ensure you are sending a file with field name "file"', 400);
            }

            // Validate file data
            if (!Buffer.isBuffer(req.file.buffer)) {
                throw new AppError('Invalid file data received. Expected a valid file buffer.', 400);
            }

            if (req.file.buffer.length === 0) {
                throw new AppError('Empty file received. Please provide a non-empty file.', 400);
            }

            // Parse options with validation
            let options;
            try {
                options = req.body.options ? JSON.parse(req.body.options) : {};
            } catch (error) {
                throw new AppError('Invalid options format. Expected valid JSON.', 400);
            }

            // Create a fresh buffer copy and validate file type
            const fileBuffer = Buffer.from(req.file.buffer);
            const fileExtension = path.extname(req.file.originalname).slice(1).toLowerCase();
            const fileType = this.#determineFileType(fileExtension, req.file.mimetype);

            if (!fileType) {
                throw new AppError(`Unsupported file type: ${fileExtension}`, 400);
            }

            // Enhanced file processing logging with signature validation
            const signatures = {
                docx: [0x50, 0x4B, 0x03, 0x04], // PK\x03\x04
                pdf: [0x25, 0x50, 0x44, 0x46],  // %PDF
                pptx: [0x50, 0x4B, 0x03, 0x04]  // PK\x03\x04 (same as docx)
            };

            const expectedSignature = signatures[fileExtension];
            const actualSignature = fileBuffer.slice(0, 4);
            const isValidSignature = expectedSignature ? 
                expectedSignature.every((byte, i) => actualSignature[i] === byte) : 
                true;

            console.log('🔄 Processing file:', {
                filename: req.file.originalname,
                mimetype: req.file.mimetype,
                size: fileBuffer.length,
                extension: fileExtension,
                type: fileType,
                signature: {
                    actual: actualSignature.toString('hex'),
                    expected: expectedSignature ? Buffer.from(expectedSignature).toString('hex') : 'N/A',
                    isValid: isValidSignature
                },
                hasOptions: !!options,
                optionsKeys: Object.keys(options)
            });

            // Additional validation for known file types
            if (expectedSignature && !isValidSignature) {
                throw new AppError(`Invalid file format: File signature does not match expected ${fileExtension.toUpperCase()} format`, 400);
            }
            

            const conversionData = {
                type: fileType,
                content: fileBuffer,
                name: req.file.originalname,
                options: {
                    ...options,
                    originalMimeType: req.file.mimetype,
                    fileSignature: actualSignature.toString('hex')
                },
                mimeType: req.file.mimetype
            };

            // Enhanced conversion preparation logging
            console.log('📤 Preparing conversion:', {
                type: conversionData.type,
                filename: conversionData.name,
                bufferLength: conversionData.content.length,
                signature: conversionData.content.slice(0, 4).toString('hex'),
                mimeType: conversionData.mimeType,
                optionsIncluded: Object.keys(conversionData.options)
            });

        // Attempt conversion with enhanced error handling
        let result;
        try {
            result = await this.conversionService.convert(conversionData);
            
            console.log('✅ Conversion complete:', {
                success: !!result,
                hasContent: !!result?.content,
                contentLength: result?.content?.length,
                imageCount: result?.images?.length,
                outputType: result?.type,
                warnings: result?.warnings?.length || 0
            });
        } catch (conversionError) {
            console.error('❌ Conversion failed:', {
                error: conversionError.message,
                type: fileType,
                filename: req.file.originalname,
                stack: conversionError.stack
            });
            throw new AppError(`Conversion failed: ${conversionError.message}`, 500);
        }

        this.#sendZipResponse(res, result);
    } catch (error) {
        console.error('❌ Conversion failed:', {
            error: error.message,
            stack: error.stack,
            type: 'file_conversion'
        });
        next(new AppError(error.message, 500));
    }
  };

  handleAudioConversion = async (req, res, next) => {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    try {
      const file = req.file;
      
      console.log('🎵 Starting audio conversion:', {
        fileName: file.originalname,
        size: file.buffer.length,
        initialMemory: Math.round(initialMemory.heapUsed / 1024 / 1024) + 'MB'
      });

      // Run garbage collection if available and memory usage is high
      if (global.gc && initialMemory.heapUsed > 512 * 1024 * 1024) {
        console.log('🧹 Running initial garbage collection');
        global.gc();
      }

      const options = JSON.parse(req.body.options || '{}');
      
      // Ensure API key is present
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      if (!apiKey) {
        throw new AppError('API key is required for audio conversion', 401);
      }

      // Create conversion data object with proper buffer
      const conversionData = {
        type: 'audio',
        content: file.buffer,
        mimeType: file.mimetype,
        name: file.originalname,
        apiKey,
        options: {
          ...options,
          streamProcessing: true, // Enable streaming processing
          memoryLimit: 512 * 1024 * 1024, // 512MB memory limit
          chunkSize: file.buffer.length > 50 * 1024 * 1024 ? 25 * 1024 * 1024 : undefined // 25MB chunks for large files
        }
      };

      const result = await this.conversionService.convert(conversionData);

      const endMemory = process.memoryUsage();
      console.log('✅ Audio conversion completed:', {
        fileName: file.originalname,
        duration: Math.round((Date.now() - startTime)/1000) + 's',
        memoryUsed: Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB',
        finalMemory: Math.round(endMemory.heapUsed / 1024 / 1024) + 'MB'
      });

      this.#sendZipResponse(res, result);

    } catch (error) {
      console.error('❌ Audio conversion failed:', {
        error: error.message,
        duration: Math.round((Date.now() - startTime)/1000) + 's',
        memoryUsed: Math.round((process.memoryUsage().heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB'
      });
      next(new AppError(error.message, error.statusCode || 500));
    }
  };

  handleVideoConversion = async (req, res, next) => {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    try {
      const file = req.file;
      if (!file) {
        throw new AppError('No video file provided', 400);
      }

      console.log('🎥 Starting video conversion:', {
        fileName: file.originalname,
        size: file.buffer.length,
        initialMemory: Math.round(initialMemory.heapUsed / 1024 / 1024) + 'MB'
      });

      // Run garbage collection if available and memory usage is high
      if (global.gc && initialMemory.heapUsed > 512 * 1024 * 1024) {
        console.log('🧹 Running initial garbage collection');
        global.gc();
      }

      const options = JSON.parse(req.body.options || '{}');
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      
      if (!apiKey) {
        throw new AppError('API key is required for video conversion', 401);
      }

      const conversionData = {
        type: 'video',
        content: file.buffer,
        name: file.originalname,
        apiKey,
        mimeType: file.mimetype,
        options: {
          ...options,
          streamProcessing: true, // Enable streaming processing
          memoryLimit: 512 * 1024 * 1024, // 512MB memory limit
          chunkSize: file.buffer.length > 50 * 1024 * 1024 ? 25 * 1024 * 1024 : undefined // 25MB chunks for large files
        }
      };

      const result = await this.conversionService.convert(conversionData);

      const endMemory = process.memoryUsage();
      console.log('✅ Video conversion completed:', {
        fileName: file.originalname,
        duration: Math.round((Date.now() - startTime)/1000) + 's',
        memoryUsed: Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB',
        finalMemory: Math.round(endMemory.heapUsed / 1024 / 1024) + 'MB'
      });

      this.#sendZipResponse(res, result);
    } catch (error) {
      console.error('❌ Video conversion failed:', {
        error: error.message,
        duration: Math.round((Date.now() - startTime)/1000) + 's',
        memoryUsed: Math.round((process.memoryUsage().heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB'
      });
      next(new AppError(error.message, error.statusCode || 500, error.details));
    }
  };

  #extractConversionData(req) {
    try {
      const { type, url, options = {} } = req.body;
      
      if (!req.file && !url) {
        throw new Error('No file or URL provided');
      }

      // Handle file uploads
      if (req.file) {
        const extension = path.extname(req.file.originalname).toLowerCase().slice(1);
        const fileType = this.#determineFileType(extension, req.file.mimetype);
        
        console.log('File type determination:', {
          originalName: req.file.originalname,
          extension,
          mimetype: req.file.mimetype,
          determinedType: fileType
        });

        return {
          type: fileType,
          content: req.file.buffer,
          name: req.file.originalname,
          apiKey: req.headers['x-api-key'],
          options
        };
      }

      // Handle URL conversion
      return {
        type: type || 'url',
        content: url,
        name: url ? new URL(url).hostname : 'Untitled',
        apiKey: req.headers['x-api-key'],
        options
      };
    } catch (error) {
      console.error('Error extracting conversion data:', error);
      throw new AppError(`Invalid request: ${error.message}`, 400);
    }
  }

  #determineFileType(extension, mimetype) {
    const mimeTypeMap = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
      'text/csv': 'csv',
      'application/csv': 'csv',
      'application/vnd.ms-excel': extension === 'csv' ? 'csv' : 'xlsx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.ms-powerpoint': 'pptx',
    };

    // Trust the extension for known document types
    if (['pptx', 'docx'].includes(extension.toLowerCase())) {
      return extension.toLowerCase();
    }

    // If extension is docx but mime type is pdf, trust the extension
    if (extension === 'docx' && mimetype === 'application/pdf') {
      console.log('Overriding PDF mime type for DOCX file');
      return 'docx';
    }

    // Special handling for CSV files
    if (extension === 'csv') {
      return 'csv';
    }

    // Otherwise use the mime type mapping or fall back to extension
    return mimeTypeMap[mimetype] || extension;
  }

  #extractBatchItems(req) {
    const { items = [] } = req.body;
    const fileItems = (req.files || []).map(file => ({
      type: 'file',
      content: file.buffer,
      name: file.originalname
    }));
    
    return [...items, ...fileItems];
  }

  #sendZipResponse(res, result) {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    try {
      // Handle different response types based on conversion result
      const contentType = result.type === 'markdown' ? 'text/markdown' : 'application/zip';
      const bufferSize = Math.round(result.buffer.length / (1024 * 1024));
      
      console.log('📤 Preparing response:', {
        type: result.type,
        filename: result.filename,
        contentType,
        sizeMB: bufferSize,
        initialMemory: Math.round(initialMemory.heapUsed / 1024 / 1024) + 'MB'
      });

      // Run garbage collection if available before sending large responses
      if (global.gc && bufferSize > 100) { // If response is larger than 100MB
        console.log('🧹 Running pre-send garbage collection');
        global.gc();
      }

      // Set response headers
      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': result.buffer.length,
        'Transfer-Encoding': bufferSize > 100 ? 'chunked' : undefined, // Use chunked encoding for large files
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });

      // Send the response
      res.send(result.buffer);

      const endMemory = process.memoryUsage();
      console.log('✅ Response sent successfully:', {
        type: result.type,
        filename: result.filename,
        sizeMB: bufferSize,
        duration: Math.round((Date.now() - startTime)/1000) + 's',
        memoryUsed: Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB',
        finalMemory: Math.round(endMemory.heapUsed / 1024 / 1024) + 'MB'
      });

      // Run garbage collection after sending large responses
      if (global.gc && bufferSize > 100) {
        console.log('🧹 Running post-send garbage collection');
        global.gc();
      }
    } catch (error) {
      console.error('❌ Failed to send response:', {
        error: error.message,
        type: result.type,
        filename: result.filename,
        duration: Math.round((Date.now() - startTime)/1000) + 's',
        memoryUsed: Math.round((process.memoryUsage().heapUsed - initialMemory.heapUsed) / 1024 / 1024) + 'MB'
      });
      throw error; // Let the error handler deal with it
    }
  }
}
