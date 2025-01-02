// services/converter/web/xmlConverter.js

import xml2js from 'xml2js';
import TurndownService from 'turndown';
import path from 'path';

/**
 * Converts an XML string or buffer to Markdown format.
 * @param {Buffer|string} input - The XML content as a buffer or string.
 * @param {string} originalName - Original filename for context.
 * @param {string} [apiKey] - API key if needed.
 * @returns {Promise<{ content: string, images: Array }>} - Converted content and images.
 */
export async function convertXmlToMarkdown(input, originalName, apiKey) {
  try {
    // Convert buffer to string if necessary
    const xmlContent = Buffer.isBuffer(input) ? input.toString('utf-8') : input;

    // Parse XML
    const parser = new xml2js.Parser({ explicitArray: false });
    const parsedXml = await parser.parseStringPromise(xmlContent);

    // Convert parsed XML to HTML or directly to Markdown
    const htmlContent = xmlToHtml(parsedXml);

    // Initialize TurndownService
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      strongDelimiter: '**'
    });

    // Add custom rules if needed
    turndownService.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: function(content) {
        return '~~' + content + '~~';
      }
    });

    // Extract images if the XML contains image references
    // This implementation assumes that images are referenced in a specific way
    // Adjust the selector based on your XML structure
    const images = [];
    // Example: If XML has <image src="data:image/png;base64,..." alt="Description" />
    // Adjust according to actual XML structure

    // For demonstration, let's assume images are in a specific tag
    // You need to modify this based on your XML schema
    if (parsedXml.images && Array.isArray(parsedXml.images.image)) {
      parsedXml.images.image.forEach((img, index) => {
        const src = img.$.src;
        const alt = img.$.alt || `Image ${index + 1}`;
        if (src) {
          if (src.startsWith('data:')) {
            const matches = src.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
            if (matches) {
              const imageType = matches[1].split('/')[1];
              const imageData = matches[2];
              const imageName = `image-${index + 1}.${imageType}`;
              images.push({
                name: imageName,
                data: imageData,
                type: `image/${imageType}`,
                path: `attachments/${path.basename(originalName, path.extname(originalName))}/${imageName}`
              });

              // Replace src with new path in htmlContent
              // This requires converting xml to HTML in a way that includes the image src
              // Alternatively, handle image references separately in Markdown
            }
          } else {
            // Handle external image URLs if needed
            images.push({
              name: path.basename(src),
              data: '', // Placeholder if you plan to download images
              type: '', // Placeholder for image type
              path: src // External path
            });
          }
        }
      });
    }

    // Convert HTML to Markdown
    let markdownContent = turndownService.turndown(htmlContent);

    // Add metadata
    const metadataMarkdown = `# ${path.basename(originalName, path.extname(originalName))}\n\n` +
                             `**Converted on:** ${new Date().toISOString()}\n\n`;

    // Combine metadata and content
    const fullMarkdown = metadataMarkdown + markdownContent;

    return {
      content: fullMarkdown,
      images: images
    };
  } catch (error) {
    console.error('Error converting XML to Markdown:', error);
    throw error;
  }
}

/**
 * Converts parsed XML object to HTML string.
 * This function should be customized based on the XML schema.
 * @param {Object} parsedXml - Parsed XML object.
 * @returns {string} - HTML string.
 */
function xmlToHtml(parsedXml) {
  // Implement a conversion logic from XML to HTML based on your specific XML structure
  // Here's a simple example for demonstration purposes:

  let html = '';

  function traverse(obj) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (typeof value === 'object') {
          html += `<${key}>`;
          traverse(value);
          html += `</${key}>`;
        } else {
          html += `<${key}>${value}</${key}>`;
        }
      }
    }
  }

  traverse(parsedXml);
  return html;
}
