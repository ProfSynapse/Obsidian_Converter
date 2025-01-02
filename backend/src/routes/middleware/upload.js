// routes/convert/middleware/upload.js

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';
import path from 'path';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

const storage = multer.memoryStorage();

// Define accepted file types
const fileFilter = (req, file, cb) => {
    // Get request path
    const requestPath = req.path;
    const fileType = file.mimetype;
    
    console.log('Processing file upload:', { path: requestPath, type: fileType });

    // Audio endpoint specific handling
    if (requestPath.includes('/multimedia/audio')) {
        const isAudio = fileType.startsWith('audio/');
        if (!isAudio) {
            return cb(new Error('Only audio files are allowed for this endpoint'));
        }
        return cb(null, true);
    }

    const allowedMimes = [
        // Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown',
        // Audio
        'audio/mpeg',
        'audio/mp4',
        'audio/wav',
        'audio/webm',
        'audio/mp3',
        // Video
        'video/mp4',
        'video/webm'
    ];

    if (allowedMimes.includes(fileType)) {
        cb(null, true);
    } else {
        cb(new Error(`Unsupported file type: ${fileType}`));
    }
};

// Create and configure multer instance with memory storage
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  },
  fileFilter
});

// Wrapper function to handle multer errors
export const uploadMiddleware = (req, res, next) => {
    // Get the last part of the path
    const pathSegments = req.path.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    let uploadHandler;

    if (lastSegment === 'file' || lastSegment === 'audio' || lastSegment === 'video') {
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
