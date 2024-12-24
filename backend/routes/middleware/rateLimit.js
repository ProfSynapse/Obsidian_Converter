// routes/convert/middleware/rateLimit.js

import rateLimit from 'express-rate-limit';
import { config } from '../../config/default.js';

/**
 * Rate limiting configuration specific to conversion routes
 */
export const conversionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.security.rateLimitPerMinute,
  message: 'Too many requests from this IP, please try again after a minute',
  standardHeaders: true,
  legacyHeaders: false,
});
