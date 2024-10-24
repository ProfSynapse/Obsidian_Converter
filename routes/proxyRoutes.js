// routes/proxyRoutes.js
import express from 'express';
import { body, validationResult } from 'express-validator';
import { openaiProxy } from '../services/openaiProxy.js';
import { AppError } from '../utils/errorHandler.js';
import rateLimit from 'express-rate-limit';
import { config } from '../config/default.js';

const router = express.Router();

// Rate limiter specific to proxy routes
const proxyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.security.rateLimitPerMinute,
  message: 'Too many requests to proxy API, please try again after a minute.',
});

// Apply rate limiter to all proxy routes
router.use(proxyLimiter);

// Validation middleware
const validateProxyRequest = [
  body('endpoint')
    .notEmpty()
    .withMessage('Endpoint is required')
    .isString()
    .withMessage('Endpoint must be a string'),
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object'),
];

router.post('/openai', validateProxyRequest, async (req, res, next) => {
  // Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      throw new AppError('API key is required in headers', 401);
    }

    const { endpoint, data } = req.body;

    const response = await openaiProxy.makeRequest(apiKey, endpoint, data);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
