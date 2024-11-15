// server.js

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { config } from './config/default.js';
import convertRoutes from './routes/index.js';
import proxyRoutes from './routes/proxyRoutes.js';
import { errorHandler, AppError } from './utils/errorHandler.js';
import morgan from 'morgan';

// Load environment variables
dotenv.config();

class Server {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || config.server.port || 3000;
        this.env = process.env.NODE_ENV || config.server.env || 'development';
        this.corsOptions = {
            origin: [
                'http://localhost:5173',    // Dev frontend
                'http://localhost:3000',    // Dev backend
                ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : [])
            ],
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
            exposedHeaders: ['Content-Disposition'],
            credentials: true,
            preflightContinue: false,
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
        // Apply CORS before other middleware
        this.app.use(cors(this.corsOptions));
        this.app.options('*', cors(this.corsOptions));

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

        // Global rate limiter
        const globalLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: config.security.globalRateLimitPerMinute || 100,
            message: {
                status: 'error',
                message: 'Too many requests from this IP, please try again later.'
            },
            standardHeaders: true,
            legacyHeaders: false
        });

        this.app.use(globalLimiter);

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
        this.app.use('/api/v1/convert', convertRoutes);
        this.app.use('/api/v1/proxy', proxyRoutes);

        // Health check route
        this.app.get('/health', this.handleHealthCheck.bind(this));

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
     * Health check endpoint handler
     */
    handleHealthCheck(req, res) {
        res.status(200).json({
            status: 'success',
            data: {
                serverTime: new Date().toISOString(),
                environment: this.env,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.env.npm_package_version || '1.0.0',
                allowedTypes: config.conversion.allowedFileTypes
            }
        });
    }

    /**
     * Start the server
     */
    start() {
        this.server = this.app.listen(this.port, () => {
            console.log('🚀 Server Details:');
            console.log(`   Environment: ${this.env}`);
            console.log(`   Port: ${this.port}`);
            console.log(`   Allowed file types: ${config.conversion.allowedFileTypes.join(', ')}`);
            console.log('   CORS enabled for:', this.corsOptions.origin);
        });

        return this.server;
    }

    /**
     * Get Express app instance
     */
    getApp() {
        return this.app;
    }
}

// Create and start server
const server = new Server();

// Start server unless we're in test environment
if (process.env.NODE_ENV !== 'test') {
    server.start();
}

export default server;