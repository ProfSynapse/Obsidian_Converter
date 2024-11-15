// routes/convert/handlers/batchHandler.js

import { createBatchZip, handleConversion } from '../utils/zipProcessor.js';
import { AppError } from '../../utils/errorHandler.js';
import { determineCategory } from '../utils/categoryDetector.js';
import sanitizeFilename from 'sanitize-filename';

export async function handleBatchConversion(req, res, next) {
    try {
        const { items } = req.body;
        const apiKey = req.headers['x-api-key'];

        if (!Array.isArray(items)) {
            throw new AppError('Items must be an array', 400);
        }

        console.log('Received batch items:', items);

        // Validate and categorize items
        const processableItems = items.map(item => {
            if (!item.type || !item.content || !item.name) {
                throw new AppError(`Invalid item format for ${item.name || 'unknown'}`, 400);
            }

            const category = determineCategory(item.type, item.fileType);
            return {
                ...item,
                category
            };
        });

        // Process items based on their category
        const results = await Promise.all(
            processableItems.map(async (item) => {
                console.log(`Processing item: ${item.name} (${item.type})`);
                
                try {
                    let conversionResult;
                    
                    switch (item.type) {
                        case 'file':
                            // Handle file conversion based on fileType
                            conversionResult = await handleConversion('file', item.content, item.name, apiKey);
                            break;
                            
                        case 'url':
                            // Handle URL conversion
                            conversionResult = await handleConversion('url', item.content, item.name);
                            break;
                            
                        case 'youtube':
                            // Handle YouTube conversion
                            conversionResult = await handleConversion('youtube', item.content, item.name);
                            break;
                            
                        default:
                            throw new AppError(`Unsupported item type: ${item.type}`, 400);
                    }

                    return {
                        name: item.name,
                        content: conversionResult.content,
                        type: item.type
                    };
                } catch (error) {
                    console.error(`Error processing item ${item.name}:`, error);
                    throw new AppError(`Failed to convert ${item.name}: ${error.message}`, 500);
                }
            })
        );

        // Create ZIP file with results
        const zipBuffer = await createBatchZip(results);
        const zipFilename = `conversion_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;

        // Send response
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename=${sanitizeFilename(zipFilename)}`,
            'Access-Control-Allow-Origin': '*', // Add this for CORS
            'Access-Control-Expose-Headers': 'Content-Disposition'
        });

        res.send(zipBuffer);

    } catch (error) {
        console.error('Batch conversion error:', error);
        next(new AppError(error.message || 'Batch conversion failed', error.status || 500));
    }
}