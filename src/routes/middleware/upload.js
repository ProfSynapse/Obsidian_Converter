// routes/convert/middleware/upload.js

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';
import path from 'path';

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    console.log('📦 Incoming file:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
    });

    // Don't try to parse binary files as JSON
    if (file.mimetype.includes('application/')) {
        req.isFileUpload = true;
    }

    cb(null, true);
};

export const uploadMiddleware = multer({
    storage,
    fileFilter,
    preservePath: true,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    }
}).single('file');

// Add new pre-processing middleware
export const preprocessRequest = (req, res, next) => {
    console.log('🔍 Request type:', {
        contentType: req.headers['content-type'],
        method: req.method,
        isFileUpload: req.isFileUpload
    });

    // Skip JSON parsing for file uploads
    if (req.isFileUpload) {
        return next();
    }

    // Only parse JSON for non-file requests
    express.json()(req, res, next);
};

// Error handling wrapper
export const handleUpload = (req, res, next) => {
    console.log('⚡ Starting file upload processing');
    
    uploadMiddleware(req, res, (err) => {
        if (err) {
            console.error('❌ Upload error:', {
                error: err.message,
                code: err.code,
                field: err.field
            });
            if (err instanceof multer.MulterError) {
                return next(new AppError(`File upload error: ${err.message}`, 400));
            } else if (err) {
                return next(new AppError('File upload failed', 500));
            }
        }
        
        if (req.file) {
            console.log('✅ Upload successful:', {
                filename: req.file.originalname,
                size: req.file.size,
                mimeType: req.file.mimetype,
                bufferLength: req.file.buffer?.length,
                signature: req.file.buffer?.slice(0, 4).toString('hex')
            });
        }
        
        // Ensure file was uploaded
        if (!req.file) {
            return next(new AppError('No file uploaded', 400));
        }

        next();
    });
};
