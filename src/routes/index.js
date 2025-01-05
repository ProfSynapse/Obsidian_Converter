// routes/index.js

import express from 'express';
import { ConversionController } from './controllers/ConversionController.js';
import { validateConversion } from './middleware/validators.js';
import { uploadMiddleware } from './middleware/upload.js';
import { apiKeyChecker } from './middleware/utils/apiKeyChecker.js';
import multer from 'multer';

const router = express.Router();
const controller = new ConversionController();
const upload = multer({ storage: multer.memoryStorage() });

// Debug middleware to log requests
router.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.path}`);
    next();
});

// Single consolidated file conversion route
router.post('/document/file',
    upload.single('file'),
    (req, res, next) => {
        console.log('📥 Incoming file request:', {
            file: req.file ? {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            } : null,
            body: req.body
        });
        next();
    },
    validateConversion,
    controller.handleFileConversion
);

// For compatibility, also keep the versioned route
router.post('/v1/document/file', upload.single('file'), controller.handleFileConversion);

// Multimedia endpoints
router.post('/multimedia/audio',
    uploadMiddleware,
    apiKeyChecker,
    validateConversion,
    controller.handleAudioConversion
);

router.post('/multimedia/video',
    uploadMiddleware,
    apiKeyChecker,
    validateConversion,
    controller.handleVideoConversion
);

// Web content endpoints
router.post('/web/url',
    validateConversion,
    controller.handleUrlConversion
);

router.post('/web/parent-url',
    validateConversion,
    controller.handleParentUrlConversion
);

router.post('/web/youtube',
    validateConversion,
    controller.handleYouTubeConversion
);

// Batch conversion endpoint
router.post('/batch',
    uploadMiddleware,
    validateConversion,
    controller.handleBatchConversion
);

export default router;