// services/converter/text/pdfConverter.js

import { exportImages } from 'pdf-export-images';
import path from 'path';
import tmp from 'tmp-promise';
import fs from 'fs/promises';
import pdf from 'pdf-parse';

/**
 * Converts a PDF buffer to Markdown format with images
 * @param {Buffer} input - PDF file buffer
 * @param {string} originalName - Original filename
 * @returns {Promise<{content: string, images: Array}>}
 */
export async function convertPdfToMarkdown(input, originalName) {
  let tempDir;
  try {
    // Create temporary directory
    tempDir = await tmp.dir({ unsafeCleanup: true });
    const tempFile = path.join(tempDir.path, 'input.pdf');
    
    // Write buffer to temporary file
    await fs.writeFile(tempFile, input);
    
    // Extract text content
    const data = await pdf(input);
    
    // Initialize markdown
    let markdown = `# ${path.basename(originalName, '.pdf')}\n\n`;
    
    // Process text content
    const pages = data.text.split('\f');
    pages.forEach((pageContent, index) => {
      if (pageContent.trim()) {
        markdown += `## Page ${index + 1}\n\n${pageContent.trim()}\n\n`;
      }
    });

    // Extract images
    console.log('Extracting images...');
    const images = await exportImages(tempFile, tempDir.path);
    console.log(`Found ${images.length} images`);

    const imageDataArray = [];
    for (const image of images) {
      try {
        const imageData = await fs.readFile(image.file);
        const imageName = path.basename(image.file);
        
        // Add image reference to markdown
        markdown += `![${imageName}](attachments/${path.basename(originalName, '.pdf')}/${imageName})\n\n`;
        
        // Store image data
        imageDataArray.push({
          name: imageName,
          data: imageData.toString('base64'),
          width: image.width,
          height: image.height
        });
      } catch (imgError) {
        console.warn(`Failed to process image ${image.file}:`, imgError);
      }
    }

    // Add metadata
    if (data.info && Object.keys(data.info).length > 0) {
      markdown += '\n## Document Information\n\n';
      Object.entries(data.info)
        .filter(([_, value]) => value && typeof value === 'string')
        .forEach(([key, value]) => {
          markdown += `- **${key}**: ${value}\n`;
        });
    }

    return {
      content: markdown.trim(),
      images: imageDataArray
    };

  } catch (error) {
    console.error('PDF conversion error:', error);
    throw error;
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      await tempDir.cleanup().catch(console.error);
    }
  }
}