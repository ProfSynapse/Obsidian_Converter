// routes/middleware/upload.js
// 📁 Enhanced file upload middleware with strict validation and detailed logging

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';
import { config } from '../../config/default.js';

// Define allowed MIME types with friendly names and validation rules
const ALLOWED_TYPES = {
    // Document types with specific validation
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        name: 'DOCX',
        validateSignature: (buffer) => {
            // DOCX files should start with PK\x03\x04 (ZIP format)
            return buffer.length >= 4 && 
                   buffer[0] === 0x50 && // P
                   buffer[1] === 0x4B && // K
                   buffer[2] === 0x03 && // \x03
                   buffer[3] === 0x04;   // \x04
        }
    },
    'application/pdf': {
        name: 'PDF',
        validateSignature: (buffer) => {
            // PDF files should start with %PDF
            return buffer.length >= 4 &&
                   buffer[0] === 0x25 && // %
                   buffer[1] === 0x50 && // P
                   buffer[2] === 0x44 && // D
                   buffer[3] === 0x46;   // F
        }
    },
    // Other document types
    'application/msword': { name: 'DOC' },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': { 
        name: 'PPTX',
        validateSignature: (buffer) => {
            // PPTX files use same signature as DOCX (ZIP format)
            return buffer.length >= 4 && 
                   buffer[0] === 0x50 && // P
                   buffer[1] === 0x4B && // K
                   buffer[2] === 0x03 && // \x03
                   buffer[3] === 0x04;   // \x04
        }
    },
    // Data formats
    'text/csv': { name: 'CSV' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { name: 'XLSX' },
    'application/yaml': { name: 'YAML' },
    // Media formats
    'audio/mpeg': { name: 'MP3' },
    'audio/wav': { name: 'WAV' },
    'video/mp4': { name: 'MP4' },
    'video/quicktime': { name: 'MOV' }
};

// Configure multer storage
const storage = multer.memoryStorage();

// Enhanced file filter with detailed validation
const fileFilter = (req, file, cb) => {
    console.log('🔍 Validating file:', {
        fieldname: file.fieldname,
        filename: file.originalname,
        mimetype: file.mimetype
    });

    if (!file.mimetype) {
        cb(new AppError('File type cannot be determined', 400), false);
        return;
    }

    if (!ALLOWED_TYPES[file.mimetype]) {
        const allowedTypesList = Object.values(ALLOWED_TYPES)
            .map(type => type.name)
            .join(', ');
        cb(new AppError(`Invalid file type. Allowed types are: ${allowedTypesList}`, 400), false);
        return;
    }

    // Log file validation
    console.log('📋 File type validation:', {
        filename: file.originalname,
        mimetype: file.mimetype,
        allowedType: ALLOWED_TYPES[file.mimetype].name
    });

    cb(null, true);
};

// Create unified upload handler with detailed logging
const upload = multer({
    storage,
    limits: {
        fileSize: config.conversion.maxFileSize || 50 * 1024 * 1024, // 50MB default
        files: 1
    },
    fileFilter,
    preservePath: true
}).single('file'); // Use consistent field name

// Debug function to inspect request
const debugRequest = (req) => ({
    method: req.method,
    path: req.path,
    headers: {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length']
    },
    isMultipart: req.headers['content-type']?.includes('multipart/form-data'),
    boundary: req.headers['content-type']?.split('boundary=')[1],
    body: req.body,
    files: req.files,
    file: req.file
});

// Main upload middleware
export const uploadMiddleware = async (req, res, next) => {
    // Log initial request state
    console.log('📥 Upload request received:', debugRequest(req));

    // Ensure request is multipart/form-data
    if (!req.headers['content-type']?.includes('multipart/form-data')) {
        console.error('❌ Invalid content type:', req.headers['content-type']);
        return next(new AppError('Request must be multipart/form-data', 400));
    }

    try {
        // Handle the upload with enhanced error handling and logging
        await new Promise((resolve, reject) => {
            upload(req, res, (err) => {
                // Log multer processing state
                console.log('🔄 Multer processing complete:', {
                    error: err?.message,
                    requestState: debugRequest(req)
                });

                if (err) {
                    if (err instanceof multer.MulterError) {
                        switch (err.code) {
                            case 'LIMIT_FILE_SIZE':
                                reject(new AppError(`File too large. Maximum size is ${config.conversion.maxFileSize / (1024 * 1024)}MB`, 400));
                                break;
                            case 'LIMIT_FILE_COUNT':
                                reject(new AppError('Too many files. Only one file allowed per request', 400));
                                break;
                            case 'LIMIT_UNEXPECTED_FILE':
                                reject(new AppError('Unexpected field name. Please use "file" as the field name', 400));
                                break;
                            default:
                                reject(new AppError(`Upload error: ${err.message}`, 400));
                        }
                    } else {
                        reject(err);
                    }
                } else {
                    resolve();
                }
            });
        });

        // Validate file presence with clear error message
        if (!req.file) {
            console.error('❌ File upload failed:', {
                headers: req.headers,
                body: req.body,
                files: req.files,
                fieldNames: req.files ? Object.keys(req.files) : [],
                isMultipart: req.headers['content-type']?.includes('multipart/form-data')
            });
            throw new AppError('No file uploaded. Please ensure you are sending a file with the field name "file"', 400);
        }

        // Enhanced file validation
        const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
        const mimeTypeEntry = Object.entries(ALLOWED_TYPES).find(([mime, type]) => 
            type.name.toLowerCase() === fileExtension.toLowerCase()
        );

        console.log('🔍 Validating file format:', {
            filename: req.file.originalname,
            extension: fileExtension,
            providedMime: req.file.mimetype,
            expectedMime: mimeTypeEntry?.[0],
            fileSize: req.file.size
        });

        if (mimeTypeEntry && req.file.mimetype !== mimeTypeEntry[0]) {
            console.warn('⚠️ File extension/MIME type mismatch:', {
                filename: req.file.originalname,
                providedMime: req.file.mimetype,
                expectedMime: mimeTypeEntry[0]
            });
        }

        // Validate file signatures for supported types
        const fileType = ALLOWED_TYPES[req.file.mimetype];
        if (fileType.validateSignature && req.file.buffer) {
            console.log('🔐 Validating file signature');
            if (!fileType.validateSignature(req.file.buffer)) {
                throw new AppError(`Invalid ${fileType.name} file format: File signature validation failed`, 400);
            }
        }

        // Log successful upload
        console.log('✅ Upload successful:', {
            fieldname: req.file.fieldname,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        next();
    } catch (error) {
        console.error('❌ Upload failed:', error);
        next(error);
    }
};
