// server.js

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { config } from './config/default.js';
import routes from './routes/index.js';  
import proxyRoutes from './routes/proxyRoutes.js';
import { errorHandler, AppError } from './utils/errorHandler.js';
import morgan from 'morgan';

// Load environment variables
dotenv.config();

class Server {
    constructor() {
        // ...existing code...
    }

    initializeMiddleware() {
        // ...existing code...

        // Body parsers with limits
        this.app.use(express.json({ 
            limit: '50mb',
            verify: (req, res, buf) => { req.rawBody = buf }
        }));
        this.app.use(express.urlencoded({ 
            extended: true, 
            limit: '50mb' 
        }));

        // Request parsing for files
        this.app.use(express.raw({ 
            type: ['application/octet-stream', 'application/pdf', 'application/msword'],
            limit: config.conversion.maxFileSize || '50mb'
        }));

        // Add request timestamp
        this.app.use((req, res, next) => {
            req.requestTime = new Date().toISOString();
            next();
        });
    }

    initializeRoutes() {
        // Mount routes directly without the /convert prefix since it's in the routes
        this.app.use('/api/v1', routes);
        this.app.use('/api/v1/proxy', proxyRoutes);

        // Health check route
        this.app.get('/health', this.handleHealthCheck.bind(this));

        // Root route for API documentation
        this.app.get('/', (req, res) => {
            res.status(200).json({
                status: 'success',
                message: 'Welcome to the Conversion API'
            });
        });

        // Handle undefined routes
        this.app.all('*', (req, res) => {
            res.status(404).json({
                status: 'error',
                message: `Cannot find ${req.originalUrl} on this server!`
            });
        });
    }

    // ...rest of existing code...
}

// Start the server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    const server = new Server();
    server.start();
}

export default Server;
