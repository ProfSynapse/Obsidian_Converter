// routes/convert/middleware/upload.js

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';
import { config } from '../../config/default.js';  // Change CONFIG to config

// Define allowed MIME types and their extensions
const ALLOWED_TYPES = {
    // Documents
    'application/pdf': ['pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
    'application/msword': ['doc'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
    'application/vnd.ms-powerpoint': ['ppt'],
    // Data files
    'text/csv': ['csv'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
    // Media files
    'audio/mpeg': ['mp3'],
    'audio/wav': ['wav'],
    'video/mp4': ['mp4'],
    'video/webm': ['webm']
};

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: config.conversion.maxFileSize || 50 * 1024 * 1024, // Update CONFIG to config
        files: 1
    },
    fileFilter: (req, file, cb) => {
        console.log('📝 Processing file:', {
            originalname: file.originalname,
            mimetype: file.mimetype
        });

        // Get file extension from original name
        const ext = file.originalname.split('.').pop().toLowerCase();
        
        // Check if MIME type is allowed and extension matches
        const allowedExtensions = ALLOWED_TYPES[file.mimetype];
        
        if (!allowedExtensions) {
            console.warn('❌ Rejected file:', {
                mimetype: file.mimetype,
                filename: file.originalname
            });
            return cb(new AppError(`Unsupported file type: ${file.mimetype}`, 415));
        }

        if (!allowedExtensions.includes(ext)) {
            console.warn('❌ Extension mismatch:', {
                extension: ext,
                allowedExtensions,
                mimetype: file.mimetype
            });
            return cb(new AppError(`Invalid file extension: ${ext}`, 415));
        }

        console.log('✅ File accepted:', {
            filename: file.originalname,
            type: file.mimetype
        });
        
        cb(null, true);
    }
});

export const uploadMiddleware = (req, res, next) => {
    const uploadHandler = upload.single('document'); // Match 'document' field name with client

    uploadHandler(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Handle Multer-specific errors
            if (err.code === 'LIMIT_FILE_SIZE') {
                return next(new AppError('File size exceeds limit (50MB)', 413));
            }
            return next(new AppError(`Upload error: ${err.message}`, 400));
        } else if (err) {
            // Handle other errors
            return next(new AppError(err.message || 'File upload failed', err.status || 400));
        }

        if (!req.file) {
            return next(new AppError('No file uploaded', 400));
        }

        // Log successful upload
        console.log('📤 File upload successful:', {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            buffer: req.file.buffer ? `${req.file.buffer.length} bytes` : 'No buffer'
        });

        next();
    });
};
