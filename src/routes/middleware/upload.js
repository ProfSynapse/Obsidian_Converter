// routes/convert/middleware/upload.js

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';
import { config } from '../../config/default.js';

// Define allowed MIME types
const ALLOWED_TYPES = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/csv': 'csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
};

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: config.conversion.maxFileSize || 50 * 1024 * 1024,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Log incoming file
        console.log('📝 Processing upload:', {
            filename: file.originalname,
            mimetype: file.mimetype
        });

        // Check MIME type
        if (!ALLOWED_TYPES[file.mimetype]) {
            return cb(new AppError(`Unsupported file type: ${file.mimetype}`, 415));
        }

        // Validate extension matches MIME type
        const ext = file.originalname.split('.').pop().toLowerCase();
        if (ext !== ALLOWED_TYPES[file.mimetype]) {
            return cb(new AppError(`File extension does not match type: ${ext}`, 415));
        }

        cb(null, true);
    }
});

export const uploadMiddleware = (req, res, next) => {
    const handler = upload.single('document');

    handler(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return next(new AppError(
                err.code === 'LIMIT_FILE_SIZE' 
                    ? 'File size exceeds 50MB limit'
                    : `Upload error: ${err.message}`,
                413
            ));
        }
        
        if (err) {
            return next(new AppError(err.message, 400));
        }

        if (!req.file) {
            return next(new AppError('No file uploaded', 400));
        }

        // Log successful upload
        console.log('✅ Upload successful:', {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        next();
    });
};
