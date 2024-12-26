// routes/convert/middleware/upload.js

import multer from 'multer';
import path from 'path';
import { AppError } from '../../utils/errorHandler.js';
import { config } from '../../config/default.js';

// Configure storage to use memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
    // Accept all files for now - validation happens in validators.js
    cb(null, true);
};

// Create and configure multer instance with memory storage
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Wrapper function to handle multer errors
export const uploadMiddleware = (req, res, next) => {
    // Get the last part of the path
    const pathSegments = req.path.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    let uploadHandler;

    if (lastSegment === 'file') {
        uploadHandler = upload.single('file');
    } else if (lastSegment === 'batch') {
        uploadHandler = upload.array('files', 10);
    } else {
        return next();
    }

    uploadHandler(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return next(new AppError('File upload error', 400, { details: err.message }));
        } else if (err) {
            return next(new AppError('Unknown error during file upload', 500, { details: err.message }));
        }
        next();
    });
};
