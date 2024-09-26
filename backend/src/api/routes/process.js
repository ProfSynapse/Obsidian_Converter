// backend/src/api/routes/process.js

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { detectFileType } from '../../utils/fileTypeDetector.js';
import { getEnhancer } from '../../enhancers/index.js';
import logger from '../../utils/logger.js';
import { transcribeAudio, transcribeVideo } from '../../services/transcriber.js';
import { scrapeContent } from '../../services/scraper.js'; // Import scraper
import authMiddleware from '../middlewares/auth.js';  // Import the authentication middleware

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDirectory = path.join(__dirname, '../../uploads');
const processedDirectory = path.join(__dirname, '../../processed');

/**
 * @route POST /api/process
 * @description Process an uploaded file or scrape a website/YouTube transcript
 * @access Protected
 * @body { type: string, data: string, outputFormat: string }
 * 
 * - type: 'file', 'url'
 * - data: filename (if type 'file'), or URL (if type 'url')
 * - outputFormat: desired output format (e.g., 'json')
 */
router.post('/', authMiddleware, async (req, res) => {  // Apply middleware here
  try {
    const { type, data, outputFormat } = req.body;

    if (!type || !data || !outputFormat) {
      return res.status(400).json({ message: 'Type, data, and output format are required.' });
    }

    let fileContent = '';
    let metadata = {};
    let summary = '';

    if (type === 'file') {
      // Processing an uploaded file
      const filename = data;
      const filePath = path.join(uploadsDirectory, filename);

      // Check if the file exists
      try {
        await fs.access(filePath);
      } catch (err) {
        logger.error(`File not found: ${filename}`);
        return res.status(404).json({ message: 'File not found.' });
      }

      // Detect file type
      const fileType = await detectFileType(filePath);
      if (!fileType) {
        return res.status(400).json({ message: 'Unsupported file type.' });
      }

      logger.info(`Processing file: ${filename} as type: ${fileType}`);

      // Get the appropriate enhancer
      const enhancer = getEnhancer(fileType);
      if (!enhancer) {
        return res.status(400).json({ message: 'No enhancer available for this file type.' });
      }

      // Handle file types
      if (['md', 'markdown', 'txt', 'pdf'].includes(fileType.toLowerCase())) {
        if (fileType.toLowerCase() === 'pdf') {
          // For PDFs, extract text using pdfUtils.js
          const { extractTextFromPDF } = await import('../../utils/pdfUtils.js');
          fileContent = await extractTextFromPDF(filePath);
        } else {
          // For Markdown and Text, read as UTF-8 text
          fileContent = await fs.readFile(filePath, 'utf8');
        }
      } else if (['mp3', 'wav', 'm4a', 'flac'].includes(fileType.toLowerCase())) {
        // For audio files, transcribe using Whisper
        metadata = await transcribeAudio(filePath);
        fileContent = metadata; // Assuming metadata contains the transcription
      } else if (['mp4', 'mov', 'avi', 'mkv'].includes(fileType.toLowerCase())) {
        // For video files, transcribe using Whisper after converting to audio
        const buffer = await fs.readFile(filePath);
        metadata = await transcribeVideo(buffer, fileType.toLowerCase());
        fileContent = metadata; // Assuming metadata contains the transcription
      } else {
        return res.status(400).json({ message: 'Unsupported file type for processing.' });
      }

      // Enhance the content
      metadata = await enhancer.addMetadata(fileContent, path.parse(filename).name);

      // Generate a summary
      summary = await enhancer.generateSummary(fileContent);

    } else if (type === 'url') {
      // Processing a URL (website or YouTube)
      const url = data;

      logger.info(`Scraping content from URL: ${url}`);

      // Scrape the content
      fileContent = await scrapeContent(url);

      // Get the appropriate enhancer (assuming all scraped content is treated as text)
      const enhancer = getEnhancer('txt'); // Use 'txt' enhancer for scraped text
      if (!enhancer) {
        return res.status(400).json({ message: 'No enhancer available for scraping results.' });
      }

      // Enhance the content
      metadata = await enhancer.addMetadata(fileContent, url); // Using URL as filename

      // Generate a summary
      summary = await enhancer.generateSummary(fileContent);
    } else {
      return res.status(400).json({ message: 'Invalid type specified. Must be "file" or "url".' });
    }

    // Prepare the response (you can extend this as needed)
    res.status(200).json({
      message: 'Content processed successfully.',
      metadata,
      summary,
      // Include additional fields like download URLs after implementing formatters
    });
  } catch (error) {
    logger.error(`Processing error: ${error.message}`);
    res.status(500).json({ message: 'Server error during processing.' });
  }
});

export default router;