// server.js

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { config } from './config/default.js';
import convertRoutes from './routes/index.js';
import proxyRoutes from './routes/proxyRoutes.js';
import { errorHandler } from './utils/errorHandler.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || config.server.port || 3000;
const ENV = process.env.NODE_ENV || config.server.env || 'development';

/**
 * Middleware Configuration
 */

// Security headers
app.use(helmet());

// Body parsers (ensure these are before your routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Configuration
app.use(cors({
  origin: ['http://localhost:5176', 'https://your-frontend-domain.com'], // Update as needed
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true,
}));

// Handle preflight requests globally
app.options('*', cors());

// Global Rate Limiter (applied after body parsers and CORS)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.security.globalRateLimitPerMinute || 100, // Default global rate limit
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// API Routes with versioning
app.use('/api/v1/convert', convertRoutes);
app.use('/api/v1/proxy', proxyRoutes);

// Health check route (moved here from convert routes)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    allowedTypes: config.conversion.allowedFileTypes,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Conversion API!');
});

// Error handling middleware (should be after all routes)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${ENV}`);
  console.log(`Allowed file types: ${config.conversion.allowedFileTypes.join(', ')}`);
});

export default app;
