// services/converter/text/pdfConverter.js


import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import crypto from 'crypto';
import * as fs from 'fs/promises';
import { promisify } from 'util';
import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import pdfParse from 'pdf-parse';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Checks if a file exists
 * @param {string} path - Path to check
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the poppler binary path based on the operating system
 * @returns {Promise<string>} Path to poppler binaries
 */
async function getPopplerPath() {
  if (process.platform === 'win32') {
    // Check common installation paths
    const possiblePaths = [
      'C:\\Program Files\\poppler\\Library\\bin',
      'C:\\Program Files\\poppler-23.11.0\\Library\\bin',
      'C:\\Program Files (x86)\\poppler\\Library\\bin',
      'C:\\poppler\\Library\\bin',
      process.env.POPPLER_PATH
    ].filter(Boolean);

    for (const binPath of possiblePaths) {
      if (!binPath) continue;
      
      const pdfimagesPath = path.join(binPath, 'pdfimages.exe');
      console.log('Checking poppler path:', pdfimagesPath);
      
      try {
        const exists = await fileExists(pdfimagesPath);
        if (exists) {
          console.log('Found poppler at:', binPath);
          return binPath;
        }
      } catch (error) {
        console.warn(`Failed to check path ${binPath}:`, error);
      }
    }
    
    throw new Error('Poppler not found. Please install poppler-utils and set POPPLER_PATH environment variable.');
  }
  
  return ''; // Unix systems typically have it in PATH
}

/**
 * Executes poppler command with proper path handling
 * @param {string} command - The command to execute
 * @returns {Promise<string>} Command output
 */
async function executePopplerCommand(command) {
  try {
    if (process.platform === 'win32') {
      const popplerPath = await getPopplerPath();
      // Add poppler path to command
      if (command.startsWith('pdfimages')) {
        command = command.replace('pdfimages', `"${path.join(popplerPath, 'pdfimages.exe')}"`);
      }
    }

    console.log('Executing command:', command);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.warn('Command stderr:', stderr);
    }
    
    return stdout;
  } catch (error) {
    console.error('Poppler command failed:', error);
    throw error;
  }
}

/**
 * Extracts images from PDF using poppler-utils with fallback
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} originalName - Original filename
 * @returns {Promise<Array>} Array of image objects
 */
async function extractImages(pdfPath, originalName) {
  const tempDir = path.join(process.cwd(), 'temp', uuidv4());
  const imageRoot = path.join(tempDir, 'image');
  const images = [];
  const imageHashes = new Map();

  try {
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Use pdfimages for extraction
      const command = `pdfimages -all "${pdfPath}" "${imageRoot}"`;
      await executePopplerCommand(command);

      // Process extracted images
      const files = await fs.readdir(tempDir);
      const imageFiles = files.filter(f => /\.(jpg|jpeg|png|ppm|pbm)$/i.test(f));

      for (const imageFile of imageFiles) {
        const imagePath = path.join(tempDir, imageFile);
        const stats = await fs.stat(imagePath);

        // Skip tiny images (likely artifacts)
        if (stats.size < 5120) continue;

        // Calculate image hash
        const imageBuffer = await fs.readFile(imagePath);
        const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

        // Check for duplicates
        if (imageHashes.has(hash)) continue;
        imageHashes.set(hash, true);

        const ext = path.extname(imageFile).slice(1);
        const baseName = path.basename(originalName, '.pdf');
        const newImageName = `${baseName}-image-${images.length + 1}.${ext}`;

        images.push({
          name: newImageName,
          data: imageBuffer.toString('base64'),
          type: `image/${ext}`,
          path: `attachments/${baseName}/${newImageName}`,
          hash: hash,
          size: stats.size
        });
      }

    } catch (error) {
      console.warn('Poppler extraction failed:', error);
      console.log('Attempting fallback image extraction...');
      return await extractImagesWithFallback(pdfPath, originalName);
    }

    return images;

  } catch (error) {
    console.error('Image extraction error:', error);
    return [];
  } finally {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  }
}

/**
 * Fallback image extraction using pdf-lib
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} originalName - Original filename
 * @returns {Promise<Array>} Array of image objects
 */
async function extractImagesWithFallback(pdfPath, originalName) {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const images = [];
    const imageHashes = new Map();

    for (let i = 0; i < pdfDoc.getPageCount(); i++) {
      const page = pdfDoc.getPage(i);
      
      // Get page resources
      if (!page || !page.node) continue;
      
      const resources = page.node.Resources;
      if (!resources) continue;
      
      const xObjects = resources.lookup('XObject');
      if (!xObjects) continue;

      // Get all XObject names
      const xObjectKeys = xObjects.keys();

      for (const key of xObjectKeys) {
        const xObject = xObjects.lookup(key);
        
        // Check if it's an image
        if (!xObject || xObject.Subtype?.name !== 'Image') continue;

        try {
          const imageData = await xObject.getContents();
          if (!imageData || imageData.length < 5120) continue;

          const hash = crypto.createHash('sha256').update(imageData).digest('hex');
          if (imageHashes.has(hash)) continue;
          
          imageHashes.set(hash, true);

          // Determine format based on filter
          const filter = xObject.Filter?.name;
          const format = filter === 'DCTDecode' ? 'jpeg' : 'png';

          const baseName = path.basename(originalName, '.pdf');
          const imageName = `${baseName}-image-${i + 1}-${images.length + 1}.${format}`;

          images.push({
            name: imageName,
            data: imageData.toString('base64'),
            type: `image/${format}`,
            path: `attachments/${baseName}/${imageName}`,
            hash: hash,
            size: imageData.length,
            pageIndex: i
          });
        } catch (imageError) {
          console.warn(`Failed to extract image from page ${i}:`, imageError);
          continue;
        }
      }
    }

    return images;
  } catch (error) {
    console.error('Fallback image extraction failed:', error);
    return [];
  }
}

/**
 * Validates PDF input buffer
 * @param {Buffer} input - The input buffer to validate
 * @returns {boolean} True if input is a valid PDF
 */
export function validatePdfInput(input) {
  if (!input || !Buffer.isBuffer(input)) return false;
  
  // Check PDF magic number
  const header = input.slice(0, 5).toString();
  if (header !== '%PDF-') return false;

  // Check for EOF marker
  const trailer = input.slice(-6).toString();
  return trailer.includes('%%EOF');
}

/**
 * Converter configuration object
 */
export const pdfConverterConfig = {
  name: 'PDF Converter',
  version: '1.0.0',
  supportedExtensions: ['.pdf'],
  supportedMimeTypes: ['application/pdf'],
  maxSizeBytes: 100 * 1024 * 1024, // 100MB
  requiresPoppler: true,
  options: {
    imageQuality: 300,
    minImageSize: 5120, // 5KB
    debug: false,
    popplerPath: process.env.POPPLER_PATH
  }
};

/**
 * Main converter function that transforms PDF to Markdown with images
 * @param {Buffer} input - The PDF file buffer
 * @param {string} originalName - Original filename for context
 * @param {string} [apiKey] - Optional API key (not used for PDF conversion)
 * @returns {Promise<{content: string, images: Array}>} - Converted content and images
 */
export async function convertPdfToMarkdown(input, originalName, apiKey) {
  if (!validatePdfInput(input)) {
    throw new Error('Invalid PDF input');
  }

  const tempDir = path.join(process.cwd(), 'temp', uuidv4());
  const tempPdfPath = path.join(tempDir, 'input.pdf');
  
  try {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(tempPdfPath, input);
    
    // Extract text
    const pdfData = await pdfParse(input);
    
    // Extract images
    const images = await extractImages(tempPdfPath, originalName);
    
    // Generate markdown content
    const baseName = path.basename(originalName, '.pdf');
    
    // Create frontmatter
    const frontmatter = [
      '---',
      `title: ${baseName}`,
      `created: ${new Date().toISOString()}`,
      `source: ${originalName}`,
      `type: pdf`,
      `pages: ${pdfData.numpages}`,
      `image_count: ${images.length}`,
      '---',
      ''
    ].join('\n');

    // Process text content
    let textContent = pdfData.text
      .replace(/\f/g, '\n\n---\n\n')
      .replace(/(\r\n|\r|\n){3,}/g, '\n\n')
      .replace(/[^\S\r\n]+/g, ' ')
      .trim();

    // Add image references
    let imageSection = '';
    if (images.length > 0) {
      imageSection = '\n\n## Extracted Images\n\n' +
        images.map(img => 
          `![${img.name}](${img.path})`
        ).join('\n\n');
    }

    const markdownContent = [
      frontmatter,
      '## Content\n',
      textContent,
      imageSection
    ].join('\n');

    return {
      content: markdownContent,
      images: images
    };

  } catch (error) {
    console.error('Error converting PDF:', error);
    throw error;
  } finally {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  }
}

export default {
  convert: convertPdfToMarkdown,
  validate: validatePdfInput,
  config: pdfConverterConfig
};