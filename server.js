// server.js

import express from 'express';
import fs from 'fs';  // Add fs import
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { config } from './src/config/default.js';
import router from './src/routes/index.js';  // Updated path
import proxyRoutes from './src/routes/proxyRoutes.js';  // Updated path
import { errorHandler, AppError } from './src/utils/errorHandler.js';
import morgan from 'morgan';
import path from 'path';  // Add path module
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

class Server {
    constructor() {
        this.app = express();
        this.server = null; // Initialize server property
        // Let Railway control the port
        this.port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
        this.env = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || 'development';
        
        // Update CORS configuration for Railway
        const allowedOrigins = [
            'https://frontend-production-2748.up.railway.app',
            'http://localhost:5173',
            'http://localhost:3000'
        ];

        this.corsOptions = {
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or curl requests)
                if (!origin) return callback(null, true);
                
                if (allowedOrigins.indexOf(origin) !== -1 || process.env.CORS_ORIGIN?.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
            exposedHeaders: ['Content-Disposition'],
            credentials: true,
            preflightContinue: false,
            optionsSuccessStatus: 204
        };

        // Apply CORS immediately
        this.app.use(cors(this.corsOptions));
        this.app.options('*', cors(this.corsOptions));

        // API routes for development and production
        this.app.use('/api/v1', router);
        this.app.use('/api/v1/proxy', proxyRoutes);

        // Initialize server
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    /**
     * Initialize all middleware
     */
    initializeMiddleware() {
        // Remove the duplicate CORS setup from here since we do it in constructor

        // Security headers
        this.app.use(helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" },
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    connectSrc: ["'self'", ...this.corsOptions.origin],
                    frameSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "blob:"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"]
                }
            }
        }));

        // Request logging
        if (this.env !== 'test') {
            this.app.use(morgan('dev'));
        }

        // Body parsers with limits
        this.app.use(express.json({ 
            limit: '50mb',
            verify: (req, res, buf) => { req.rawBody = buf }
        }));
        this.app.use(express.urlencoded({ 
            extended: true, 
            limit: '50mb' 
        }));

        // Request parsing - consolidated configuration
        this.app.use(express.raw({ 
            type: ['audio/*', 'video/*'],
            limit: config.conversion.maxFileSize || '50mb'
        }));

        // Add request timestamp
        this.app.use((req, res, next) => {
            req.requestTime = new Date().toISOString();
            next();
        });
    }

    /**
     * Initialize API routes
     */
    initializeRoutes() {
        // API Routes
        this.app.use('/api/v1', router);  // Mount routes directly under /api/v1
        this.app.use('/api/v1/proxy', proxyRoutes);

        // Root route
        this.app.get('/', (req, res) => {
            res.status(200).json({
                status: 'success',
                message: 'Welcome to the Conversion API',
                documentation: '/api/v1/docs'
            });
        });

        // Handle undefined routes
        this.app.all('*', (req, res, next) => {
            next(new AppError(`Cannot find ${req.originalUrl} on this server!`, 404));
        });
    }

    /**
     * Initialize error handlers
     */
    initializeErrorHandling() {
        this.app.use(errorHandler);
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
            console.error(error.name, error.message);
            process.exit(1);
        });

        // Handle unhandled rejections
        process.on('unhandledRejection', (error) => {
            console.error('UNHANDLED REJECTION! 💥 Shutting down...');
            console.error(error.name, error.message);
            this.server.close(() => {
                process.exit(1);
            });
        });

        // Handle SIGTERM
        process.on('SIGTERM', () => {
            console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
            this.server.close(() => {
                console.log('💥 Process terminated!');
            });
        });
    }

    /**
     * Start the server
     */
    async start() {
        try {
            return new Promise((resolve, reject) => {
                this.server = this.app.listen(this.port, () => {
                    console.log(`🚀 Server is running on http://localhost:${this.port}`);
                    console.log('🚀 Server Details:');
                    console.log(`   Environment: ${this.env}`);
                    console.log(`   Port: ${this.port}`);
                    console.log(`   API Base Path: /api/v1`);
                    console.log('   CORS enabled for:', this.corsOptions.origin);
                    resolve(this.server);
                });

                this.server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        console.error(`❌ Port ${this.port} is already in use`);
                    } else {
                        console.error('❌ Server error:', error);
                    }
                    reject(error);
                });
            });
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            throw error;
        }
    }

    /**
     * Get Express app instance
     */
    getApp() {
        return this.app;
    }
}

// Initialize and start server
let serverInstance = null;

async function startServer() {
    try {
        const server = new Server();
        serverInstance = await server.start();
        return serverInstance;
    } catch (error) {
        console.error('❌ Server initialization failed:', error);
        process.exit(1);
    }
}

// Start the server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    startServer();
}

export default startServer;