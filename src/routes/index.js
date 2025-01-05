// routes/index.js

import express from 'express';
import { ConversionController } from './controllers/ConversionController.js';
import { validateConversion } from './middleware/validators.js';
import { uploadMiddleware, preprocessRequest } from './middleware/upload.js';
import { apiKeyChecker } from './middleware/utils/apiKeyChecker.js';

const router = express.Router();
const controller = new ConversionController();

// Debug middleware to log requests
router.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.path}`);
    next();
});

// Document endpoints
router.post('/document/file',
    preprocessRequest,  // Add preprocessing
    uploadMiddleware,
    (req, res, next) => {
        console.log('📄 Received file:', {
            name: req.file?.originalname,
            type: req.file?.mimetype,
            size: req.file?.size,
            bufferHead: req.file?.buffer?.slice(0, 4).toString('hex')
        });
        next();
    },
    validateConversion,
    controller.handleFileConversion
);

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