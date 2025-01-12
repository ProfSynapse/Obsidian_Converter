// routes/middleware/upload.js
// 📁 Enhanced file upload middleware with strict validation and detailed logging

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';
import { config } from '../../config/default.js';

// Define allowed MIME types with friendly names for error messages
const ALLOWED_TYPES = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'text/csv': 'CSV',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/yaml': 'YAML',
    'audio/mpeg': 'MP3',
    'audio/wav': 'WAV',
    'video/mp4': 'MP4',
    'video/quicktime': 'MOV'
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
        const allowedTypesList = Object.values(ALLOWED_TYPES).join(', ');
        cb(new AppError(`Invalid file type. Allowed types are: ${allowedTypesList}`, 400), false);
        return;
    }

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

        // Validate content type matches extension
        const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
        const expectedMimeType = Object.entries(ALLOWED_TYPES).find(([, ext]) => 
            ext.toLowerCase() === fileExtension
        )?.[0];

        if (expectedMimeType && req.file.mimetype !== expectedMimeType) {
            console.warn('⚠️ File extension mismatch:', {
                filename: req.file.originalname,
                providedMime: req.file.mimetype,
                expectedMime: expectedMimeType
            });
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
