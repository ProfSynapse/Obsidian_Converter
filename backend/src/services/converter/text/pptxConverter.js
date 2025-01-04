// services/converter/text/pptxConverter.js

import JSZip from 'jszip';
import TurndownService from 'turndown';
import path from 'path';

/**
 * Simple XML text extractor using regex
 * @param {string} xml - XML content
 * @returns {string} - Extracted text
 */
function extractTextFromXml(xml) {
  // Extract text between <a:t> tags
  const matches = xml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
  return matches
    .map(match => match.replace(/<a:t>|<\/a:t>/g, ''))
    .join(' ')
    .trim();
}

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
    const presentationName = path.basename(originalName, path.extname(originalName));
    
    // Extract slides content
    const slideFiles = Object.keys(zip.files)
      .filter(fileName => /^ppt\/slides\/slide\d+\.xml$/.test(fileName))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/)[1]);
        const numB = parseInt(b.match(/slide(\d+)\.xml/)[1]);
        return numA - numB;
      });

    // Initialize markdown content with metadata
    let markdown = [
      `# ${presentationName}`,
      '',
      '---',
      'type: presentation',
      `created: ${new Date().toISOString()}`,
      `original: ${originalName}`,
      '---',
      '',
      ''
    ].join('\n');

    const images = [];

    // Process each slide
    for (const slideFileName of slideFiles) {
      const slideNumber = slideFileName.match(/slide(\d+)\.xml/)[1];
      const slideXml = await zip.file(slideFileName).async('string');
      const slideText = extractTextFromXml(slideXml);
      
      markdown += `## Slide ${slideNumber}\n\n`;
      
      // Extract images for this slide
      const slideImages = await extractImagesForSlide(zip, slideNumber, presentationName);
      images.push(...slideImages);
      
      // Add image references using Obsidian attachment format
      slideImages.forEach(img => {
        markdown += `![[${img.filename}]]\n\n`;
      });
      
      // Add slide text content
      if (slideText) {
        markdown += `${slideText}\n\n`;
      }
      
      markdown += `---\n\n`;
    }

    return {
      content: markdown.trim(),
      images: images.map(img => ({
        name: img.filename,
        data: img.data,
        type: img.type,
        // Ensure path follows Obsidian attachment structure
        path: `attachments/${presentationName}/${img.filename}`
      }))
    };
  } catch (error) {
    console.error('PPTX conversion error:', error);
    throw error;
  }
}

async function extractImagesForSlide(zip, slideNumber, presentationName) {
  const images = [];
  const mediaFolder = zip.folder('ppt/media');
  
  if (mediaFolder) {
    // Get relationship file for this slide
    const relsFile = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
    const relsContent = await zip.file(relsFile)?.async('string');
    
    if (relsContent) {
      // Find image references in relationships
      const imageRefs = relsContent.match(/Target="\.\.\/media\/[^"]+"/g) || [];
      
      for (const ref of imageRefs) {
        const imageFile = ref.match(/media\/([^"]+)/)[1];
        const file = mediaFolder.file(imageFile);
        
        if (file && /\.(png|jpg|jpeg|gif|svg)$/i.test(imageFile)) {
          const imageData = await file.async('base64');
          const extension = path.extname(imageFile);
          const filename = `${presentationName}_slide${slideNumber}_${path.basename(imageFile)}`;
          
          images.push({
            filename,
            data: imageData,
            type: `image/${extension.slice(1).toLowerCase()}`,
            slideNumber: parseInt(slideNumber)
          });
        }
      }
    }
  }
  
  return images;
}
