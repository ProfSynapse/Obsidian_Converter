// services/converter/text/docxConverter.js

import mammoth from 'mammoth';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Converts a DOCX buffer to Markdown format while properly handling images
 * @param {Buffer} buffer - The DOCX file buffer
 * @param {string} originalName - Original filename for context
 * @returns {Promise<{content: string, images: Array}>} Markdown content and images
 */
export async function convertDocxToMarkdown(buffer, originalName) {
  try {
    console.log('Starting DOCX conversion:', originalName);
    
    // Store extracted images
    const images = [];
    
    // Get base name for folder structure
    const baseName = path.basename(originalName, '.docx');
    
    // Configure conversion options
    const options = {
      convertImage: mammoth.images.imgElement(async (image) => {
        try {
          // Get image buffer and info
          const imageBuffer = await image.read();
          const extension = image.contentType.split('/')[1];
          const imageName = `${baseName}-${uuidv4().slice(0, 8)}.${extension}`;
          
          // Store image info and data
          images.push({
            name: imageName,
            data: imageBuffer.toString('base64'),
            type: image.contentType,
            path: `attachments/${baseName}/${imageName}`
          });
          
          // Return markdown image reference
          return {
            src: `attachments/${baseName}/${imageName}`
          };
        } catch (error) {
          console.error('Error processing image:', error);
          return { src: 'error-processing-image' };
        }
      })
    };

    // Correctly pass the buffer directly
    const result = await mammoth.convertToMarkdown(buffer, options);

    // Log any warnings
    if (result.messages.length > 0) {
      console.log('Conversion warnings:', result.messages);
    }

    // Create the frontmatter and content
    const markdown = [
      '---',
      `title: ${baseName}`,
      `attachmentFolder: attachments/${baseName}`,
      'created: ' + new Date().toISOString(),
      '---',
      '',
      result.value
    ].join('\n');

    // Return both markdown and images with proper paths
    return {
      content: markdown,
      images: images
    };

  } catch (error) {
    console.error('Error converting DOCX:', error);
    throw error;
  }
}
