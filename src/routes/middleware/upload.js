// routes/convert/middleware/upload.js

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';
import path from 'path';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    console.log('🔍 Incoming file details:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        encoding: file.encoding,
        headers: file.headers
    });

    // Mark request as multipart
    req.isMultipart = true;

    cb(null, true);
};

export const uploadMiddleware = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024
    }
}).single('file');

export const handleUpload = async (req, res, next) => {
    try {
        console.log('⚙️ Processing upload request:', {
            contentType: req.headers['content-type'],
            isMultipart: req.isMultipart
        });

        uploadMiddleware(req, res, (err) => {
            if (err) {
                console.error('❌ Upload error:', err);
                return next(new AppError(err.message, 400));
            }

            if (!req.file) {
                return next(new AppError('No file uploaded', 400));
            }

            console.log('✅ File received:', {
                filename: req.file.originalname,
                size: req.file.size,
                mimeType: req.file.mimetype,
                bufferLength: req.file.buffer?.length,
                header: req.file.buffer?.slice(0, 4).toString('hex')
            });

            next();
        });
    } catch (error) {
        next(error);
    }
};
