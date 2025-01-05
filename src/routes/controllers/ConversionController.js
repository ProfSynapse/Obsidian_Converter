import { ConversionService } from "../../services/ConversionService.js";
import { AppError } from '../../utils/errorHandler.js';
import path from 'path';

export class ConversionController {
  constructor() {
    this.conversionService = new ConversionService();
  }

  handleConversion = async (req, res, next) => {
    try {
      const file = req.file;
      const options = JSON.parse(req.body.options || '{}');
      
      // Add API key from headers
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      if (apiKey) {
        options.apiKey = apiKey;
      }

      console.log('Processing conversion:', {
        fileName: file.originalname,
        fileType: file.mimetype,
        hasApiKey: !!apiKey
      });

      const result = await this.conversionService.convert(file, options);
      
      if (!result.buffer || !result.filename) {
        throw new Error('Invalid conversion result');
      }

      // Send ZIP file response
      this.#sendZipResponse(res, result);
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  };

  handleBatchConversion = async (req, res, next) => {
    try {
        const files = req.files || [];
        const items = JSON.parse(req.body.items || '[]');
        
        // Process file uploads with proper content handling
        const fileItems = files.map(file => ({
            id: crypto.randomUUID(),
            type: this.#determineFileType(path.extname(file.originalname).slice(1), file.mimetype),
            content: file.buffer, // Ensure buffer is passed
            name: file.originalname,
            mimeType: file.mimetype,
            options: {
                includeImages: true,
                includeMeta: true,
                convertLinks: true
            }
        }));

        // Process URL items with proper content
        const urlItems = items.map(item => ({
            ...item,
            content: item.url,
            type: item.type.toLowerCase(),
            options: {
                includeImages: true,
                includeMeta: true,
                convertLinks: true,
                ...item.options
            }
        }));

        // Combine all items
        const allItems = [...fileItems, ...urlItems];

        console.log(`Processing batch conversion of ${allItems.length} items:`, 
            allItems.map(i => ({ name: i.name, type: i.type })));

        const result = await this.conversionService.convertBatch(allItems);
        this.#sendZipResponse(res, result);

    } catch (error) {
        console.error('Batch conversion error:', error);
        next(new AppError(
            error.message || 'Failed to process batch conversion',
            error.statusCode || 500
        ));
    }
  };

  handleUrlConversion = async (req, res, next) => {
    try {
      const data = {
        type: 'url',
        content: req.body.url,
        name: new URL(req.body.url).hostname,
        options: req.body.options
      };
      
      const result = await this.conversionService.convert(data);
      this.#sendZipResponse(res, result);
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  };

  handleParentUrlConversion = async (req, res, next) => {
    try {
      const data = {
        type: 'parenturl',
        content: req.body.parenturl,
        name: new URL(req.body.parenturl).hostname,
        options: req.body.options
      };
      
      const result = await this.conversionService.convert(data);
      this.#sendZipResponse(res, result);
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  };

  handleYouTubeConversion = async (req, res, next) => {
    try {
      const data = {
        type: 'youtube',
        content: req.body.url,
        name: `youtube-${Date.now()}`,
        options: req.body.options
      };
      
      const result = await this.conversionService.convert(data);
      this.#sendZipResponse(res, result);
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  };

  handleFileConversion = async (req, res, next) => {
    try {
        console.log('📝 File conversion request:', {
            headers: req.headers,
            fileInfo: req.file ? {
                fieldname: req.file.fieldname,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.buffer?.length
            } : null
        });

        if (!req.file) {
            throw new AppError('No file provided', 400);
        }

        // Ensure we have a valid buffer
        if (!Buffer.isBuffer(req.file.buffer)) {
            throw new AppError('Invalid file data received', 400);
        }

        // Create a fresh buffer copy to prevent any modifications
        const fileBuffer = Buffer.from(req.file.buffer);

        // Log buffer state for debugging
        console.log('Processing file:', {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: fileBuffer.length,
            signature: fileBuffer.slice(0, 4).toString('hex')
        });

        const conversionData = {
            type: this.#determineFileType(
                path.extname(req.file.originalname).slice(1),
                req.file.mimetype
            ),
            content: fileBuffer,
            name: req.file.originalname,
            options: JSON.parse(req.body.options || '{}')
        };

        // Log conversion data
        console.log('📤 Preparing conversion:', {
            type: conversionData.type,
            filename: conversionData.name,
            bufferLength: conversionData.content.length,
            signature: conversionData.content.slice(0, 4).toString('hex')
        });

        const result = await this.conversionService.convert(conversionData);
        
        console.log('✅ Conversion complete:', {
            success: !!result,
            hasContent: !!result?.content,
            contentLength: result?.content?.length,
            imageCount: result?.images?.length
        });

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
    try {
      const file = req.file;
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
        options
      };

      const result = await this.conversionService.convert(conversionData);
      this.#sendZipResponse(res, result);

    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  };

  handleVideoConversion = async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            throw new AppError('No video file provided', 400);
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
            options,
            mimeType: file.mimetype
        };

        const result = await this.conversionService.convert(conversionData);
        this.#sendZipResponse(res, result);
    } catch (error) {
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
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });
    res.send(result.buffer);
  }
}
