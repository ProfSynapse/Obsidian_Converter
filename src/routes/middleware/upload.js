// routes/convert/middleware/upload.js

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 1
    }
});

export const uploadMiddleware = (req, res, next) => {
    const uploadHandler = upload.single('document');

    uploadHandler(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return next(new AppError('File size exceeds 50MB limit', 413));
            }
            return next(new AppError(`Upload error: ${err.message}`, 400));
        } else if (err) {
            return next(new AppError('Upload failed: ' + err.message, 400));
        }

        if (!req.file) {
            return next(new AppError('No file uploaded', 400));
        }

        // Log successful upload
        console.log('📤 File upload successful:', {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        next();
    });
};
