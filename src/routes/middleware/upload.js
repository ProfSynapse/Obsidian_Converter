// routes/convert/middleware/upload.js

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';
import path from 'path';

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 1
    }
});

export const uploadMiddleware = (req, res, next) => {
    const multerSingle = upload.single('file');

    multerSingle(req, res, (err) => {
        if (err) {
            console.error('File upload error:', {
                error: err.message,
                code: err.code,
                field: err.field,
                type: 'UPLOAD_ERROR'
            });

            if (err instanceof multer.MulterError) {
                return next(new AppError(`Upload error: ${err.message}`, 400));
            }
            
            if (err.message.includes('Unexpected end of form')) {
                return next(new AppError('Upload incomplete or corrupted', 400));
            }

            return next(new AppError(err.message, 500));
        }

        // Validate file was received
        if (!req.file && req.headers['content-type']?.includes('multipart/form-data')) {
            return next(new AppError('No file received', 400));
        }

        // Log successful file details
        if (req.file) {
            console.log('📁 File received:', {
                filename: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                fieldname: req.file.fieldname
            });
        }

        next();
    });
};
