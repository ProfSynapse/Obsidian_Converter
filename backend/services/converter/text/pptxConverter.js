// services/converter/text/pptxConverter.js

import JSZip from 'jszip';
import TurndownService from 'turndown';
import path from 'path';

/**
 * Converts a PPTX buffer to Markdown format, extracting text and images.
 * @param {Buffer} input - The PPTX file buffer.
 * @param {string} originalName - Original filename for context.
 * @param {string} [apiKey] - API key if needed.
 * @returns {Promise<{ content: string, images: Array }>} - Converted content and images.
 * @throws {Error} - If conversion fails.
 */
export async function convertPptxToMarkdown(input, originalName, apiKey) {
  try {
    const zip = await JSZip.loadAsync(input);
    const slides = [];

    // Extract all slide XML files
    const slideFiles = Object.keys(zip.files).filter(fileName => /^ppt\/slides\/slide\d+\.xml$/.test(fileName));

    // Extract images from 'ppt/media/' folder
    const mediaFolder = zip.folder('ppt/media');
    const images = [];

    if (mediaFolder) {
      const imageFiles = Object.keys(mediaFolder.files);
      for (const imageFileName of imageFiles) {
        const file = mediaFolder.file(imageFileName);
        if (file) {
          const imageBuffer = await file.async('base64');
          const imageType = imageFileName.split('.').pop().toLowerCase();
          images.push({
            name: file.name,
            data: imageBuffer,
            type: `image/${imageType}`,
            path: `attachments/${path.basename(originalName, path.extname(originalName))}/${file.name}`
          });
        }
      }
    }

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });

    let markdown = `# ${path.basename(originalName, path.extname(originalName))}\n\n`;
    markdown += `**Converted on:** ${new Date().toISOString()}\n\n`;

    // Process each slide
    for (const slideFileName of slideFiles) {
      const slideXml = await zip.file(slideFileName).async('string');
      const slideContent = extractTextFromPPTX(slideXml);

      markdown += `## Slide ${extractSlideNumber(slideFileName)}\n\n`;
      markdown += turndownService.turndown(slideContent) + '\n\n';
    }

    // Append image references to markdown (optional)
    images.forEach((image, index) => {
      markdown += `![Image ${index + 1}](attachments/${path.basename(originalName, path.extname(originalName))}/${image.name})\n\n`;
    });

    return {
      content: markdown,
      images: images
    };
  } catch (error) {
    console.error('Error converting PPTX to Markdown:', error);
    throw error;
  }
}

/**
 * Extracts text content from PPTX slide XML.
 * @param {string} slideXml - The slide XML content.
 * @returns {string} - Extracted text as HTML.
 */
function extractTextFromPPTX(slideXml) {
  // Simple regex-based extraction of text within <a:t> tags
  const textMatches = slideXml.match(/<a:t>(.*?)<\/a:t>/g);
  const texts = textMatches ? textMatches.map(match => match.replace(/<\/?a:t>/g, '')) : [];
  return texts.join(' ');
}

/**
 * Extracts slide number from slide file name.
 * @param {string} slideFileName - The slide file name (e.g., ppt/slides/slide1.xml).
 * @returns {number} - The slide number.
 */
function extractSlideNumber(slideFileName) {
  const match = slideFileName.match(/slide(\d+)\.xml$/);
  return match ? parseInt(match[1], 10) : 0;
}
