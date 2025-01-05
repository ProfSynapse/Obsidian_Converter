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

const createUpload = (fieldName) => multer({
    storage,
    limits: {
        fileSize: config.conversion.maxFileSize || 50 * 1024 * 1024,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        console.log('📝 Processing upload:', {
            fieldname: file.fieldname,
            filename: file.originalname,
            mimetype: file.mimetype
        });

        // Accept all file types initially and validate later
        cb(null, true);
    }
}).single(fieldName);

export const uploadMiddleware = (req, res, next) => {
    console.log('💡 Upload request received:', {
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length']
    });

    // Try both field names that the client might send
    const tryUpload = async () => {
        try {
            // Try 'uploadedFile' first (used by client)
            const handler = createUpload('uploadedFile');
            await new Promise((resolve, reject) => {
                handler(req, res, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        } catch (firstError) {
            try {
                // Fallback to 'file'
                const handler = createUpload('file');
                await new Promise((resolve, reject) => {
                    handler(req, res, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            } catch (secondError) {
                return next(new AppError('File upload failed: Invalid field name or file', 400));
            }
        }

        if (!req.file) {
            return next(new AppError('No file uploaded', 400));
        }

        // Log successful upload
        console.log('✅ Upload successful:', {
            fieldname: req.file.fieldname,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        next();
    };

    tryUpload().catch(next);
};
