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
    console.log('Starting DOCX conversion:', {
      originalName,
      bufferLength: buffer.length,
      bufferType: typeof buffer,
      isBuffer: Buffer.isBuffer(buffer),
      firstBytes: buffer.slice(0, 4).toString('hex')
    });

    // Validate buffer is a valid DOCX file
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Invalid input: Expected a buffer');
    }

    // Check for DOCX file signature (PK zip header)
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
      throw new Error('Invalid DOCX format: Missing ZIP header');
    }

    // Validate buffer
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Invalid input: Buffer expected');
    }

    // Check minimum file size
    if (buffer.length < 4) {
      throw new Error('Invalid DOCX: File too small');
    }

    // Verify DOCX signature (PKZip header)
    const signature = buffer.slice(0, 4);
    if (signature[0] !== 0x50 || signature[1] !== 0x4B || signature[2] !== 0x03 || signature[3] !== 0x04) {
      throw new Error('Invalid DOCX format: File appears to be corrupted');
    }
    
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
    const result = await mammoth.convertToMarkdown(buffer, options);

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
