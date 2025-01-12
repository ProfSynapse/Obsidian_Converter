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
    // Enhanced buffer validation with detailed logging
    console.log('🔍 Validating input buffer:', {
      type: typeof buffer,
      isBuffer: Buffer.isBuffer(buffer),
      isUint8Array: buffer instanceof Uint8Array,
      length: buffer?.length
    });

    if (!Buffer.isBuffer(buffer)) {
      if (buffer instanceof Uint8Array) {
        console.log('📝 Converting Uint8Array to Buffer');
        buffer = Buffer.from(buffer);
      } else {
        console.error('❌ Invalid buffer type:', typeof buffer);
        throw new Error(`Invalid input: Expected buffer or Uint8Array, got ${typeof buffer}`);
      }
    }

    // Create a copy of the buffer to prevent modifications
    const workingBuffer = Buffer.from(buffer);

    console.log('🚀 Starting DOCX conversion:', {
      originalName,
      bufferLength: workingBuffer.length,
      bufferType: typeof workingBuffer,
      isBuffer: Buffer.isBuffer(workingBuffer),
      firstBytes: workingBuffer.slice(0, 4).toString('hex'),
      signature: workingBuffer.slice(0, 4).equals(Buffer.from([0x50, 0x4B, 0x03, 0x04])) ? 'Valid DOCX' : 'Invalid DOCX'
    });

    // Enhanced DOCX structure validation
    if (workingBuffer.length < 4) {
      console.error('❌ Buffer too small:', workingBuffer.length, 'bytes');
      throw new Error(`Invalid DOCX format: Buffer too small (${workingBuffer.length} bytes)`);
    }

    const signature = workingBuffer.slice(0, 4);
    const expectedSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
    
    console.log('🔐 Validating DOCX signature:', {
      found: signature.toString('hex'),
      expected: expectedSignature.toString('hex'),
      isValid: signature.equals(expectedSignature)
    });

    if (!signature.equals(expectedSignature)) {
      throw new Error('Invalid DOCX format: Incorrect file signature');
    }

    // Enhanced buffer state logging
    console.log('📦 Processing DOCX buffer:', {
      totalLength: workingBuffer.length,
      header: workingBuffer.slice(0, 4).toString('hex'),
      isValidSignature: workingBuffer.slice(0, 4).equals(Buffer.from([0x50, 0x4B, 0x03, 0x04])),
      previewContent: workingBuffer.slice(4, 20).toString('hex')
    });

    // Store extracted images
    const images = [];
    
    // Get base name for folder structure
    const baseName = path.basename(originalName, '.docx');
    
    // Configure conversion options with strict settings
    const options = {
      convertImage: mammoth.images.imgElement(async (image) => {
        try {
          // Enhanced image validation
          const imageBuffer = await image.read();
          console.log('🖼️ Processing image:', {
            contentType: image.contentType,
            size: imageBuffer?.length || 0,
            hasData: !!imageBuffer && imageBuffer.length > 0
          });

          if (!imageBuffer || imageBuffer.length === 0) {
            console.warn('⚠️ Empty image data encountered');
            return { src: '' };
          }

          // Validate image content type
          if (!image.contentType || !image.contentType.startsWith('image/')) {
            console.warn('⚠️ Invalid image content type:', image.contentType);
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

    console.log('⚙️ Converting DOCX with options:', {
      hasImageHandler: !!options.convertImage,
      styleMapRules: options.styleMap.length,
      bufferSize: workingBuffer.length
    });

    // Convert to markdown with enhanced error handling
    let result;
    try {
      result = await mammoth.convertToMarkdown(workingBuffer, options);
    } catch (conversionError) {
      console.error('❌ Mammoth conversion error:', {
        error: conversionError.message,
        stack: conversionError.stack,
        bufferState: workingBuffer.length > 0 ? 'Has Content' : 'Empty'
      });
      throw new Error(`DOCX conversion failed: ${conversionError.message}`);
    }

    if (!result || !result.value) {
      console.error('❌ No content produced from conversion');
      throw new Error('Conversion produced no content');
    }

    console.log('✅ Conversion successful:', {
      contentLength: result.value.length,
      hasWarnings: result.messages.length > 0,
      warningCount: result.messages.length,
      imageCount: images.length,
      contentPreview: result.value.substring(0, 100)
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
