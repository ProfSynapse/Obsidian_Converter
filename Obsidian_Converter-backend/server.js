// server.js

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { convertToMarkdown, convertUrlToMarkdown } from './src/converter.js';
import { enhanceNote } from './src/enhancer.js';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs/promises';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));

// Set up multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory as Buffer
const upload = multer({ storage: storage });

// Routes

/**
 * POST /convert
 * Handles both file uploads and URL conversions.
 * If a file is uploaded, it processes the file.
 * If a URL is provided, it processes the URL.
 */
app.post('/convert', upload.single('file'), async (req, res) => {
  const { apiKey, url } = req.body;
  const file = req.file;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  if (!file && !url) {
    return res.status(400).json({ error: 'No file or URL provided' });
  }

  try {
    let convertedContent;

    if (file) {
      // Determine the file type based on mimetype or originalname
      const fileType = getFileTypeFromMimetype(file.mimetype) || getFileTypeFromFilename(file.originalname);
      if (!fileType) {
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      console.log(`Converting file of type: ${fileType}`);

      // Convert the file Buffer to Markdown
      convertedContent = await convertToMarkdown(file.buffer, fileType, apiKey);
    } else if (url) {
      // Convert the URL content to Markdown
      convertedContent = await convertUrlToMarkdown(url, apiKey);
    }

    // Enhance the converted content
    const enhancedContent = await enhanceNote(convertedContent, file ? file.originalname : 'URL_Conversion', apiKey);

    res.json({ convertedContent: enhancedContent });
  } catch (error) {
    console.error('Error during conversion:', error);
    res.status(500).json({ error: 'Conversion failed', details: error.message });
  }
});

// Helper functions

/**
 * Determine file type from mimetype
 * @param {string} mimetype - The MIME type of the file
 * @returns {string|null} - The file extension or null if unsupported
 */
function getFileTypeFromMimetype(mimetype) {
  const mimeMap = {
    'text/plain': 'txt',
    'text/html': 'html',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/rtf': 'rtf',
    'application/pdf': 'pdf',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/webm': 'webm'
  };
  return mimeMap[mimetype] || null;
}

/**
 * Determine file type from filename extension
 * @param {string} filename - The original filename
 * @returns {string|null} - The file extension or null if unsupported
 */
function getFileTypeFromFilename(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const supportedTypes = ['txt', 'html', 'htm', 'docx', 'rtf', 'pdf', 'mp3', 'wav', 'm4a', 'ogg', 'mp4', 'mov', 'avi', 'webm'];
  return supportedTypes.includes(ext) ? ext : null;
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Accepting requests from ${corsOptions.origin}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    console.log('HTTP server closed');
  });
});
