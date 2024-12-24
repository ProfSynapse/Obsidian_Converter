// routes/index.js

import express from 'express';
import { conversionRateLimiter } from './middleware/rateLimit.js';
import { validators } from './middleware/validators.js';
import { apiKeyChecker } from './utils/apiKeyChecker.js';
import { upload } from './middleware/upload.js';
import { handleBatchConversion } from './handlers/batchHandler.js';
import { handleFileUpload } from './handlers/fileHandler.js';
import { handleUrlConversion } from './handlers/urlHandler.js';
import { handleParentUrlConversion } from './handlers/parentUrlHandler.js';
import { handleYouTubeConversion } from './handlers/youtubeHandler.js';

const router = express.Router();

// Apply rate limiter to all conversion routes
router.use(conversionRateLimiter);

// Parent URL conversion endpoint - place before regular URL endpoint
router.post(
    '/parent-url',
    validators.parenturl,
    validators.checkResult,
    handleParentUrlConversion
);

// Single URL conversion endpoint
router.post(
    '/url',
    validators.url,
    validators.checkResult,
    handleUrlConversion
);

// Other routes...
router.post(
    '/batch',
    validators.batch,
    validators.checkResult,
    handleBatchConversion
);

router.post(
    '/file',
    apiKeyChecker,
    upload,
    validators.file,
    validators.checkResult,
    handleFileUpload
);

router.post(
    '/youtube',
    validators.youtube,
    validators.checkResult,
    handleYouTubeConversion
);

export default router;