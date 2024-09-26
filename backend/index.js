// backend/index.js

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import uploadRouter from './src/api/routes/upload.js';
import processRouter from './src/api/routes/process.js';
import downloadRouter from './src/api/routes/download.js';
import { errorHandler } from './src/api/middlewares/errorHandler.js';
import logger from './src/utils/logger.js'; // Ensure your logger is the default export

// Load environment variables from .env file
dotenv.config();

/**
 * Validate essential environment variables
 */
const requiredEnvVars = ['PORT', 'NODE_ENV'];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    logger.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

const app = express();

/**
 * Rate Limiting Middleware
 * Limits each IP to 100 requests per 15 minutes
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});

app.use(limiter);

/**
 * Middleware Setup
 */
app.use(helmet()); // Secures HTTP headers
app.use(cors()); // Enables Cross-Origin Resource Sharing
app.use(express.json()); // Parses incoming JSON requests
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded bodies
app.use(morgan('combined', { stream: logger.stream })); // HTTP request logger using custom logger

/**
 * Routes
 */
app.use('/api/upload', uploadRouter);
app.use('/api/process', processRouter);
app.use('/api/download', downloadRouter);

/**
 * Basic Health Check Route
 */
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Information Processor API' });
});

/**
 * Error Handling Middleware
 * Should be placed after all routes
 */
app.use(errorHandler);

/**
 * Start the Server
 */
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

/**
 * Graceful Shutdown
 */
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('Closed out remaining connections.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10_000);
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  // Optionally, you can shut down the server
  // process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception thrown: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
