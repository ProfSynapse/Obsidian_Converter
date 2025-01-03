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
      const items = this.#extractBatchItems(req);
      const result = await this.conversionService.convertBatch(items);
      
      this.#sendZipResponse(res, result);
    } catch (error) {
      next(new AppError(error.message, 500));
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
      const file = req.file;
      const options = JSON.parse(req.body.options || '{}');
      
      const result = await this.conversionService.convert({
        type: 'document',
        content: file.buffer,
        name: file.originalname,
        options
      });

      this.#sendZipResponse(res, result);
    } catch (error) {
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
      const options = JSON.parse(req.body.options || '{}');
      
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      if (!apiKey) {
        throw new AppError('API key is required for video conversion', 401);
      }

      const result = await this.conversionService.convert({
        type: 'video',
        content: file.buffer,
        name: file.originalname,
        apiKey,
        options
      });

      this.#sendZipResponse(res, result);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
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
    // Map of common mime types to file extensions
    const mimeTypeMap = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc'
    };

    // If extension is docx but mime type is pdf, trust the extension
    if (extension === 'docx' && mimetype === 'application/pdf') {
      console.log('Overriding PDF mime type for DOCX file');
      return 'docx';
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
