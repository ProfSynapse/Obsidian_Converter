// server.js

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/default.js';
import convertRoutes from './routes/convertRoutes.js';
import proxyRoutes from './routes/proxyRoutes.js';
import { errorHandler } from './utils/errorHandler.js';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || config.server.port || 3000;
const ENV = process.env.NODE_ENV || config.server.env || 'development';

// Middleware
app.use(helmet());

// Configure CORS to allow specific origins and headers
app.use(cors({
  origin: ['http://localhost:5173', 'https://your-frontend-domain.com'], // Update as needed
  methods: ['GET', 'POST', 'OPTIONS'], // Include OPTIONS method for preflight
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'], // Add 'x-api-key' here
  credentials: true, // If you need to send cookies or authentication headers
}));

// Handle preflight requests globally
app.options('*', cors());

// Global Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.security.rateLimitPerMinute * 2, // Example: global rate limit
  message: 'Too many requests from this IP, please try again later.',
});

app.use(globalLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes with versioning
app.use('/api/v1/convert', convertRoutes);
app.use('/api/v1/proxy', proxyRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${ENV}`);
  console.log(`Allowed file types: ${config.conversion.allowedFileTypes.join(', ')}`);
});

export default app;
