// routes/convert/middleware/upload.js

import multer from 'multer';
import { AppError } from '../../utils/errorHandler.js';
import path from 'path';

const storage = multer.memoryStorage();

// Define supported MIME types
const supportedMimeTypes = {
    // Documents
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/plain': 'txt',
    'text/markdown': 'md',
    // Audio
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/mp3': 'mp3',
    // Video
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    // CSV
    'text/csv': 'csv',
    'application/csv': 'csv',
    'application/vnd.ms-excel': 'xls',
    // Presentations
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.ms-powerpoint': 'ppt'
};

const fileFilter = (req, file, cb) => {
    // Get request path
    const requestPath = req.path;
    const fileType = file.mimetype;
    const fileExt = file.originalname.split('.').pop().toLowerCase();
    
    console.log('Processing file upload:', { path: requestPath, type: fileType });

    // Audio endpoint specific handling
    if (requestPath.includes('/multimedia/audio')) {
        const isAudio = fileType.startsWith('audio/');
        if (!isAudio) {
            return cb(new Error('Only audio files are allowed for this endpoint'));
        }
        return cb(null, true);
    }

    const extension = supportedMimeTypes[fileType];
    if (!extension) {
        return cb(new AppError(`Unsupported file type: ${fileType}`, 400));
    }

    // Set the determined file extension for later use
    file.detectedExtension = extension;
    cb(null, true);
};

// Create multer instances
export const upload = multer({
    storage,
    fileFilter
});

export const videoUpload = multer({
    storage,
    fileFilter
});

// Wrapper function to handle multer errors
export const uploadMiddleware = (req, res, next) => {
    const pathSegments = req.path.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    let uploadHandler;

    if (lastSegment === 'video') {
        uploadHandler = videoUpload.single('file');
    } else if (lastSegment === 'file' || lastSegment === 'audio') {
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
