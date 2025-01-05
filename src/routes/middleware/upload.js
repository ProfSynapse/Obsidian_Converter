// routes/convert/middleware/upload.js

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';
import path from 'path';

// Configure multer for memory storage
const storage = multer.memoryStorage({
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    console.log('📥 Upload received:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        fieldname: file.fieldname,
        headers: file.headers
    });

    const mimeTypeMap = {
        'application/pdf': 'pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/msword': 'doc'
    };

    const fileType = mimeTypeMap[file.mimetype] || path.extname(file.originalname).slice(1).toLowerCase();

    // Store file metadata for later use
    file.detectedType = fileType;
    file.originalContentType = file.mimetype;

    console.log('Processing file upload:', {
        filename: file.originalname,
        mimetype: file.mimetype,
        detectedType: fileType,
        fieldname: file.fieldname
    });

    cb(null, true);
};

export const uploadMiddleware = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 1
    }
}).single('file');

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
