// backend/src/api/routes/download.js

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getMimeType } from '../../utils/fileTypeDetector.js';
import logger from '../../utils/logger.js';

const router = express.Router();

/**
 * @file download.js
 * @description Handles file download requests.
 */

/**
 * Get the directory name of the current module.
 * This is necessary because `__dirname` is not available in ES modules.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Directory where processed files are stored.
 * Adjust the path if your processed files are stored elsewhere.
 */
const processedDirectory = path.join(__dirname, '../../processed');

/**
 * @route GET /api/download/:filename
 * @description Download a processed file by filename
 * @access Public
 * @param {string} filename - The name of the file to download
 */
router.get('/:filename', (req, res) => {
  const { filename } = req.params;

  // Prevent directory traversal attacks by resolving the absolute path
  const filePath = path.resolve(processedDirectory, filename);

  // Ensure the file is within the processed directory
  if (!filePath.startsWith(processedDirectory)) {
    logger.warn(`Attempted directory traversal attack: ${filename}`);
    return res.status(400).json({ message: 'Invalid file path.' });
  }

  // Check if the file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.error(`File not found: ${filename}`);
      return res.status(404).json({ message: 'File not found.' });
    }

    // Determine the MIME type based on the file extension
    const mimeType = getMimeType(path.extname(filename).slice(1));

    // Set the appropriate headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');

    // Stream the file to the client
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (streamErr) => {
      logger.error(`Error streaming file ${filename}: ${streamErr.message}`);
      res.status(500).json({ message: 'Error downloading the file.' });
    });

    logger.info(`File downloaded: ${filename}`);
  });
});

export default router;
