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
    // Ensure we have a valid buffer
    if (!Buffer.isBuffer(buffer)) {
      if (buffer instanceof Uint8Array) {
        buffer = Buffer.from(buffer);
      } else {
        throw new Error('Invalid input: Expected buffer or Uint8Array');
      }
    }

    // Create a copy of the buffer to prevent modifications
    const workingBuffer = Buffer.from(buffer);

    console.log('Starting DOCX conversion:', {
      originalName,
      bufferLength: workingBuffer.length,
      bufferType: typeof workingBuffer,
      isBuffer: Buffer.isBuffer(workingBuffer),
      firstBytes: workingBuffer.slice(0, 4).toString('hex')
    });

    // Validate DOCX structure
    if (workingBuffer.length < 4 || 
        workingBuffer[0] !== 0x50 || // P
        workingBuffer[1] !== 0x4B || // K
        workingBuffer[2] !== 0x03 || // \x03
        workingBuffer[3] !== 0x04) { // \x04
      throw new Error('Invalid DOCX format: Not a valid ZIP/DOCX file');
    }

    // Log buffer state
    console.log('Processing DOCX buffer:', {
      length: workingBuffer.length,
      header: workingBuffer.slice(0, 4).toString('hex'),
      isValid: workingBuffer.slice(0, 4).equals(Buffer.from([0x50, 0x4B, 0x03, 0x04]))
    });

    // Store extracted images
    const images = [];
    
    // Get base name for folder structure
    const baseName = path.basename(originalName, '.docx');
    
    // Configure conversion options with strict settings
    const options = {
      convertImage: mammoth.images.imgElement(async (image) => {
        try {
          // Additional validation for image data
          const imageBuffer = await image.read();
          if (!imageBuffer || imageBuffer.length === 0) {
            console.warn('Empty image data encountered');
            return { src: '' };
          }

          const extension = image.contentType.split('/')[1] || 'png';
          const imageName = `${baseName}-${uuidv4().slice(0, 8)}.${extension}`;
          
          images.push({
            name: imageName,
            data: imageBuffer.toString('base64'),
            type: image.contentType,
            path: `attachments/${baseName}/${imageName}`
          });
          
          return {
            src: `attachments/${baseName}/${imageName}`
          };
        } catch (error) {
          console.error('Image processing error:', error);
          return { src: '' };
        }
      }),
      styleMap: [
        "p[style-name='Section Title'] => h1",
        "p[style-name='Subsection Title'] => h2"
      ]
    };

    console.log('Converting DOCX with options:', options);

    // Convert to markdown with enhanced error handling
    const result = await mammoth.convertToMarkdown(workingBuffer, options);

    if (!result || !result.value) {
      throw new Error('Conversion produced no content');
    }

    console.log('Conversion successful:', {
      contentLength: result.value.length,
      hasWarnings: result.messages.length > 0,
      imageCount: images.length
    });

    // Log any conversion warnings
    if (result.messages.length > 0) {
      console.warn('Conversion warnings:', result.messages);
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

    // Explicitly set success flag
    return {
      success: true,
      content: markdown,
      images: images,
      warnings: result.messages
    };

  } catch (error) {
    console.error('Error converting DOCX:', error);
    throw new Error(`DOCX conversion failed: ${error.message}`);
  }
}
