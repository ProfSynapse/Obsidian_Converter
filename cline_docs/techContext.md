# Technical Context

## Technologies Used
1. **Core Framework & Runtime**
   - Node.js (>=14.0.0)
   - Express.js

2. **File Processing Libraries**
   - @bundled-es-modules/pdfjs-dist: PDF processing
   - mammoth: DOCX processing
   - csv-parse: CSV processing
   - office-text-extractor: Office document handling
   - fluent-ffmpeg: Audio/video processing
   - youtube-transcript: YouTube transcription

3. **Utility Libraries**
   - archiver: ZIP file creation
   - jszip: ZIP file handling
   - turndown: HTML to Markdown conversion
   - file-type: File type detection
   - multer: File upload handling
   - puppeteer: Web page rendering and scraping

4. **Security & Middleware**
   - helmet: Security headers
   - cors: Cross-origin resource sharing
   - express-validator: Request validation
   - dotenv: Environment variable management

5. **Development Tools**
   - Babel: JavaScript transpilation
   - ESLint: Code linting
   - nodemon: Development server
   - husky: Git hooks

## Development Setup
1. **Prerequisites**
   - Node.js >= 14.0.0
   - NPM or equivalent package manager

2. **Environment Variables**
   - PORT: Server port (default: 3000)
   - RAILWAY_ENVIRONMENT: Deployment environment
   - API keys for protected services

3. **Installation**
   ```bash
   npm install
   ```

4. **Development Server**
   ```bash
   npm start
   ```

## Technical Constraints
1. **File Processing**
   - File size limits based on configuration
   - Specific file type support
   - Memory constraints for large files

2. **API Limitations**
   - Rate limiting for API endpoints
   - Authentication required for certain operations
   - CORS restrictions

3. **Deployment**
   - Railway.app deployment configuration
   - Environment-specific settings
   - Resource limitations based on hosting
