# System Patterns

## Architecture
- Express.js backend server
- Modular design with separate routes, controllers, and services
- Factory pattern for converter selection
- Middleware for request processing and validation

## Key Technical Decisions
1. **Converter Factory Pattern**
   - Uses a factory pattern to create appropriate converters based on file type
   - Each file type has its own specialized converter implementation

2. **File Processing**
   - Handles file uploads via multipart/form-data
   - Validates file signatures and MIME types
   - Buffers file content for processing

3. **Error Handling**
   - Centralized error handling middleware
   - Custom AppError class for consistent error formatting
   - Detailed error logging with stack traces

4. **Security**
   - CORS configuration with allowed origins
   - Helmet for security headers
   - API key authentication for protected endpoints

5. **Batch Processing**
   - Supports multiple file conversions in one request
   - Handles mixed content types (files + URLs)
   - Returns results in ZIP format

## Implementation Patterns
1. **Controllers**
   - Handle HTTP request/response
   - Input validation and sanitization
   - Route to appropriate service methods

2. **Services**
   - Business logic implementation
   - Converter selection and execution
   - File type detection and processing

3. **Middleware**
   - Request validation
   - File upload handling
   - API key verification
   - Error handling

4. **Utils**
   - File type detection
   - ZIP processing
   - Error handling
   - Markdown generation
