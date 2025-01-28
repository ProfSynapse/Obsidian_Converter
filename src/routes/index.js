// routes/index.js

import express from 'express';
import { ConversionController } from './controllers/ConversionController.js';
import { validateConversion } from './middleware/validators.js';
import { uploadMiddleware } from './middleware/upload.js';
import { apiKeyChecker } from './middleware/utils/apiKeyChecker.js';
import paymentRoutes from './paymentRoutes.js';
const router = express.Router();
const controller = new ConversionController();

// Debug middleware to log requests with enhanced details
router.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.path}`);
    next();
});

// Document endpoints with enhanced error handling
router.post('/document/file',
    (req, res, next) => {
        console.log('📥 File upload request:', {
            method: req.method,
            path: req.path,
            headers: {
                'content-type': req.headers['content-type'],
                'content-length': req.headers['content-length'],
                'accept': req.headers['accept']
            },
            body: req.body,
            isMultipart: req.headers['content-type']?.includes('multipart/form-data'),
            boundary: req.headers['content-type']?.split('boundary=')[1]
        });
        next();
    },
    uploadMiddleware,
    (req, res, next) => {
        // Log successful file upload before validation
        if (req.file) {
            console.log('📁 File received:', {
                fieldname: req.file.fieldname,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            });
        }
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

// Batch conversion endpoint
router.post('/batch',
    uploadMiddleware,
    validateConversion,
    controller.handleBatchConversion
);

// Payment endpoints
router.use('/payment', (req, res, next) => {
    console.log('💰 Payment request:', {
        method: req.method,
        path: req.path,
        amount: req.body?.amount
    });
    next();
}, paymentRoutes);

export default router;
