// routes/convert/middleware/upload.js

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';
import path from 'path';

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Log incoming file details
    console.log('Processing uploaded file:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        fieldname: file.fieldname
    });

    // Store original content type
    file.originalContentType = file.mimetype;
    cb(null, true);
};

export const uploadMiddleware = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
}).single('file');

// Error handling wrapper
export const handleUpload = (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return next(new AppError(`File upload error: ${err.message}`, 400));
        } else if (err) {
            return next(new AppError('File upload failed', 500));
        }
        
        // Ensure file was uploaded
        if (!req.file) {
            return next(new AppError('No file uploaded', 400));
        }

        next();
    });
};
