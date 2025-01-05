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
        
        // Simplified CORS configuration
        const allowedOrigins = [
            'https://frontend-production-2748.up.railway.app',
            'http://localhost:5173',
            'http://localhost:3000'
        ];

        this.corsOptions = {
            origin: allowedOrigins,
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
            exposedHeaders: ['Content-Disposition'],
            credentials: true,
            optionsSuccessStatus: 204
        };

        // Initialize server
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    /**
     * Initialize all middleware
     */
    initializeMiddleware() {
        // Apply CORS
        this.app.use(cors(this.corsOptions));

        // Security headers configuration
        this.app.use(helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" },
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    connectSrc: ["'self'", 'https://frontend-production-2748.up.railway.app'],
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

        // Handle multipart and raw data before JSON parsing
        this.app.use((req, res, next) => {
            console.log('🔍 Request interceptor:', {
                method: req.method,
                path: req.path,
                contentType: req.headers['content-type']
            });

            // Skip JSON parsing for multipart and binary data
            if (req.headers['content-type']?.includes('multipart/form-data') ||
                req.headers['content-type']?.includes('application/octet-stream')) {
                return next();
            }

            // Only parse JSON for appropriate requests
            if (req.headers['content-type']?.includes('application/json')) {
                express.json({
                    limit: '50mb',
                    verify: (req, res, buf) => {
                        req.rawBody = buf;
                    }
                })(req, res, next);
            } else {
                next();
            }
        });

        // Conditionally parse JSON only for application/json
        this.app.use((req, res, next) => {
            if (req.is('application/json')) {
                return express.json({ limit: '50mb' })(req, res, next);
            }
            next();
        });

        // Conditionally parse urlencoded only for form submissions
        this.app.use((req, res, next) => {
            if (req.is('application/x-www-form-urlencoded')) {
                return express.urlencoded({
                    extended: true,
                    limit: '50mb'
                })(req, res, next);
            }
            next();
        });

        // Consolidate raw body handling into a single middleware
        this.app.use(express.raw({
            type: [
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/pdf',
                'application/msword',
                'application/octet-stream',
                'application/x-www-form-urlencoded',
                'multipart/form-data',
                'text/*',
                'application/*',
                'audio/*',
                'video/*'
            ],
            limit: config.conversion.maxFileSize || '50mb',
            verify: (req, res, buf) => {
                // Store original buffer
                req.rawBody = Buffer.from(buf);
            }
        }));

        // Handle binary data properly
        this.app.use(express.raw({
            type: [
                'application/octet-stream',
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword'
            ],
            limit: '50mb',
            verify: (req, res, buf) => {
                // Store original binary data
                req.rawBody = buf;
            }
        }));

        // Add buffer validation and logging middleware
        this.app.use((req, res, next) => {
            const contentType = req.headers['content-type'];
            if (contentType?.includes('application/')) {
                // Log buffer details for debugging
                console.log('Received file buffer:', {
                    contentType,
                    bufferLength: req.rawBody?.length,
                    firstBytes: req.rawBody?.slice(0, 4).toString('hex')
                });

                if (!req.rawBody || !Buffer.isBuffer(req.rawBody)) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid file buffer received'
                    });
                }
            }
            next();
        });

        // Add content-type validation
        this.app.use((req, res, next) => {
            if (req.is('multipart/form-data')) {
                return next();
            }
            
            if (req.headers['content-type']?.includes('application/')) {
                if (!req.rawBody) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Missing binary content'
                    });
                }
            }
            next();
        });

        // Add request timestamp
        this.app.use((req, res, next) => {
            req.requestTime = new Date().toISOString();
            // Log incoming requests for debugging
            console.log(`${req.method} ${req.path}`, {
                contentType: req.headers['content-type'],
                bodyType: typeof req.body
            });
            next();
        });

        // Add error handling for parsing errors
        this.app.use((err, req, res, next) => {
            if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
                console.error('Request Parse Error:', err);
                return res.status(400).json({
                    status: 400,
                    error: {
                        message: 'Invalid request format',
                        code: 'PARSE_ERROR',
                        details: err.message
                    }
                });
            }
            next(err);
        });

        // Add timeout and limit configurations
        this.app.use((req, res, next) => {
            // Increase timeout for upload requests
            if (req.headers['content-type']?.includes('multipart/form-data')) {
                req.setTimeout(300000); // 5 minutes
                res.setTimeout(300000); // 5 minutes
            }
            next();
        });

        // Update multipart handling
        this.app.use((req, res, next) => {
            if (req.headers['content-type']?.includes('multipart/form-data')) {
                const boundary = req.headers['content-type'].split('boundary=')[1];
                console.log('🔍 Processing multipart request:', {
                    method: req.method,
                    path: req.path,
                    contentType: req.headers['content-type'],
                    contentLength: req.headers['content-length'],
                    boundary
                });
            }
            next();
        });

        // Update multipart handling
        this.app.use((req, res, next) => {
            if (req.headers['content-type']?.includes('multipart/form-data')) {
                console.log('🔍 Processing multipart request:', {
                    method: req.method,
                    path: req.path,
                    contentType: req.headers['content-type']
                });
            }
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