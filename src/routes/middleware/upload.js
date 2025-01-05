// routes/convert/middleware/upload.js

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';
import path from 'path';

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Validate content type
    const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/pdf',
        'application/msword'
    ];

    if (!allowedTypes.includes(file.mimetype) && 
        !file.originalname.match(/\.(docx|pdf|doc)$/i)) {
        return cb(new Error('Invalid file type'), false);
    }

    // Set original content type for later use
    file.detectedType = file.mimetype;

    console.log('Receiving file:', {
        filename: file.originalname,
        mimetype: file.mimetype,
        fieldname: file.fieldname
    });

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
