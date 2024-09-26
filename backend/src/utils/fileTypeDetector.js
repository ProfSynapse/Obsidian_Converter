// backend/src/utils/fileTypeDetector.js

import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs/promises';
import logger from './logger.js';

/**
 * Detects the file type from a file buffer.
 * @param {string} filePath - The path to the file.
 * @returns {Promise<string|null>} The detected file type extension or null if not detected.
 */
export async function detectFileType(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const fileType = await fileTypeFromBuffer(buffer);
    if (fileType) {
      logger.info(`File type detected: ${fileType.ext}`);
      return fileType.ext;
    } else {
      logger.warn('File type could not be detected');
      return null;
    }
  } catch (error) {
    logger.error(`Error detecting file type: ${error.message}`);
    throw new Error('File type detection failed');
  }
}

/**
 * Gets the MIME type for a given file extension.
 * @param {string} extension - The file extension (e.g., 'pdf', 'json').
 * @returns {string|null} The corresponding MIME type or null if not found.
 */
export function getMimeType(extension) {
  const mimeTypes = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    json: 'application/json',
    xml: 'application/xml',
    csv: 'text/csv',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    markdown: 'text/markdown',
    md: 'text/markdown',
    html: 'text/html',
    // Add more as needed
  };

  const mimeType = mimeTypes[extension.toLowerCase()];
  if (mimeType) {
    logger.info(`MIME type for .${extension}: ${mimeType}`);
    return mimeType;
  } else {
    logger.warn(`No MIME type found for extension: ${extension}`);
    return null;
  }
}
