// routes/convert/middleware/upload.js

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';
import path from 'path';

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        fieldSize: 50 * 1024 * 1024, // 50MB field size limit
        files: 1,
        parts: 2 // file and options fields
    }
});

export const uploadMiddleware = (req, res, next) => {
    // Log incoming request details
    console.log('📥 Upload request:', {
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'],
        boundary: req.headers['content-type']?.split('boundary=')[1]
    });

    const multerSingle = upload.single('file');

    // Set a longer timeout for the request
    req.setTimeout(300000); // 5 minutes

    multerSingle(req, res, (err) => {
        if (err) {
            console.error('🔥 File upload error details:', {
                message: err.message,
                code: err.code,
                field: err.field,
                type: err.type || 'UPLOAD_ERROR',
                name: err.name,
                stack: err.stack
            });

            // Handle specific multer errors
            if (err instanceof multer.MulterError) {
                switch (err.code) {
                    case 'LIMIT_FILE_SIZE':
                        return next(new AppError('File too large (max 50MB)', 400));
                    case 'LIMIT_UNEXPECTED_FILE':
                        return next(new AppError('Wrong field name for file upload (use "file")', 400));
                    default:
                        return next(new AppError(`Upload error: ${err.message}`, 400));
                }
            }

            // Handle incomplete form data
            if (err.message.includes('Unexpected end of form')) {
                return next(new AppError('Upload interrupted or incomplete. Please try again.', 400));
            }

            return next(new AppError(err.message || 'File upload failed', 500));
        }

        // Validate file presence and format
        if (!req.file && req.headers['content-type']?.includes('multipart/form-data')) {
            console.error('❌ No file in request:', {
                headers: req.headers,
                body: req.body
            });
            return next(new AppError('No file received in upload', 400));
        }

        // Log successful file upload
        if (req.file) {
            console.log('✅ File received successfully:', {
                filename: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                fieldname: req.file.fieldname,
                encoding: req.file.encoding,
                buffer: req.file.buffer ? `${req.file.buffer.length} bytes` : 'no buffer'
            });
        }

        next();
    });
};
