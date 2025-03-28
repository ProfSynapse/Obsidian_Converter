// src/lib/api/errors.js

/**
 * Custom error class for conversion-related errors
 */
export class ConversionError extends Error {
    constructor(message, code = 'CONVERSION_ERROR', details = null) {
        super(message);
        this.name = 'ConversionError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }

    /**
     * Creates a validation error instance
     */
    static validation(message, details = null) {
        return new ConversionError(message, 'VALIDATION_ERROR', details);
    }

    /**
     * Creates an error instance from API response
     */
    static fromResponse(response) {
        // Log the response for debugging
        console.log('🔍 Creating error from response:', JSON.stringify(response, null, 2));
        
        try {
            // Special case: If response contains jobId, it's actually a success
            if (response && response.jobId) {
                console.log('⚠️ Warning: Response with jobId was incorrectly treated as an error');
                return new ConversionError(
                    'Response with jobId was incorrectly treated as an error',
                    'RESPONSE_MISCLASSIFIED',
                    { jobId: response.jobId }
                );
            }
            
            // Handle structured error responses
            if (response && response.error) {
                return new ConversionError(
                    response.error.message || 'Unknown server error',
                    response.error.code || 'API_ERROR',
                    response.error.details
                );
            }
            
            // Handle error status responses
            if (response && response.status === 'error') {
                return new ConversionError(
                    response.message || 'Server reported an error',
                    response.code || 'API_ERROR',
                    response.details || null
                );
            }
            
            // Handle plain error messages
            if (response && typeof response.message === 'string') {
                return new ConversionError(
                    response.message,
                    response.code || 'API_ERROR',
                    response.details || null
                );
            }
            
            // Fallback for unexpected response formats
            return new ConversionError(
                'Unexpected server response format',
                'RESPONSE_FORMAT_ERROR',
                { originalResponse: response }
            );
        } catch (err) {
            // Ultimate fallback if error creation itself fails
            console.error('Error while creating ConversionError:', err);
            return new ConversionError(
                'Failed to process error response',
                'ERROR_PROCESSING_ERROR',
                { originalError: err.message }
            );
        }
    }
}

/**
 * Error utility functions
 */
export const ErrorUtils = {
    wrap(error) {
        if (error instanceof ConversionError) return error;
        
        // Check for validation errors from API
        if (error.status === 400 || error?.response?.status === 400) {
            return ConversionError.validation(
                error.message || 'Validation failed',
                error.details
            );
        }
        
        return new ConversionError(
            error.message,
            'UNKNOWN_ERROR',
            error
        );
    },

    isRetryable(error) {
        // Add status code check
        if (error.status === 400 || error?.response?.status === 400) {
            return false;
        }

        const retryableCodes = ['NETWORK_ERROR', 'API_ERROR', 'TIMEOUT_ERROR'];
        return retryableCodes.includes(error?.code);
    }
};
