// services/fileProcessor.js
import { textConverterFactory } from './converter/textConverterFactory.js';
import { storeConvertedFile } from './fileStorage.js';
import { AppError } from '../utils/errorHandler.js';
import path from 'path';
import sanitize from 'sanitize-filename';

export async function processFile(fileBuffer, fileType, apiKey, originalName) {
  try {
    // Use the factory to convert the file
    const convertedContent = await textConverterFactory.convertToMarkdown(
      fileBuffer,
      fileType,
      apiKey,
      originalName
    );

    // Create filename
    const filename = `${sanitize(originalName.replace(path.extname(originalName), ''))}.md`;

    console.log(`Converted content for ${filename}:`, convertedContent.substring(0, 100));

    // Store and return fileId
    const fileId = storeConvertedFile(convertedContent, filename);
    return fileId;

  } catch (error) {
    console.error(`Error processing file ${originalName}:`, error);
    throw new AppError('File conversion failed', 500, error.message);
  }
}