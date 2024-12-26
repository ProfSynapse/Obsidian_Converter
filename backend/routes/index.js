// routes/index.js

import express from 'express';
import { ConversionController } from './controllers/ConversionController.js';
import { validateConversion } from './middleware/validators.js';
import { uploadMiddleware } from './middleware/upload.js';

const router = express.Router();
const controller = new ConversionController();

// Debug middleware to log requests
router.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.path}`);
    next();
});

// Single file conversion - match frontend endpoint exactly
router.post('/file',
    uploadMiddleware,
    validateConversion,
    (req, res, next) => {
        console.log('Processing file conversion request:', {
            body: req.body,
            file: req.file,
            path: req.path
        });
        next();
    },
    controller.handleConversion
);

// Batch conversion
router.post('/batch',
    uploadMiddleware,
    validateConversion,
    controller.handleBatchConversion
);

// URL-based conversions
router.post('/url',
    validateConversion,
    controller.handleUrlConversion
);

router.post('/parent-url',
    validateConversion,
    controller.handleParentUrlConversion
);

router.post('/youtube',
    validateConversion,
    controller.handleYouTubeConversion
);

export default router;