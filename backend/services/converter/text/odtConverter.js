// services/converter/text/odtConverter.js

import JSZip from 'jszip';
import xml2js from 'xml2js';
import TurndownService from 'turndown';
import path from 'path';

/**
 * Converts an ODT buffer to Markdown format, extracting text and images.
 * @param {Buffer} input - The ODT file buffer.
 * @param {string} originalName - Original filename for context.
 * @param {string} [apiKey] - API key if needed.
 * @returns {Promise<{ content: string, images: Array }>} - Converted content and images.
 */
export async function convertOdtToMarkdown(input, originalName, apiKey) {
  try {
    const zip = await JSZip.loadAsync(input);

    // Extract content.xml
    const contentXml = await zip.file('content.xml').async('string');

    // Extract images from 'Pictures/' folder
    const imagesFolder = zip.folder('Pictures');
    const images = [];

    if (imagesFolder) {
      const imageFiles = Object.keys(imagesFolder.files);
      for (const imageFileName of imageFiles) {
        const file = imagesFolder.file(imageFileName);
        if (file) {
          const imageBuffer = await file.async('base64');
          const imageType = file.name.split('.').pop().toLowerCase();
          images.push({
            name: file.name,
            data: imageBuffer,
            type: `image/${imageType}`,
            path: `attachments/${path.basename(originalName, path.extname(originalName))}/${file.name}`
          });
        }
      }
    }

    // Parse content.xml
    const parser = new xml2js.Parser();
    const parsedXml = await parser.parseStringPromise(contentXml);

    // Extract text and image references
    const body = parsedXml['office:document-content']['office:body'][0]['office:text'][0];
    const textContent = extractTextFromODT(parsedXml);

    // Initialize TurndownService for markdown conversion
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });

    // Convert HTML to Markdown
    const markdownContent = turndownService.turndown(textContent);

    // Build markdown with metadata and table of contents
    let markdown = `# ${path.basename(originalName, path.extname(originalName))}\n\n`;
    markdown += `**Author:** ${parsedXml['office:document-content']['office:meta'][0]['dc:creator'] ? parsedXml['office:document-content']['office:meta'][0]['dc:creator'][0] : 'Unknown'}\n\n`;
    markdown += `**Description:** ${parsedXml['office:document-content']['office:meta'][0]['dc:description'] ? parsedXml['office:document-content']['office:meta'][0]['dc:description'][0] : 'N/A'}\n\n`;
    markdown += `**Publication Date:** ${parsedXml['office:document-content']['office:meta'][0]['meta:creation-date'] ? parsedXml['office:document-content']['office:meta'][0]['meta:creation-date'][0] : 'Unknown'}\n\n`;

    // Table of Contents - optional, based on headings
    markdown += `## Table of Contents\n\n`;
    // Optionally parse headings from markdownContent
    const headings = markdownContent.match(/^#{1,6}\s.+$/gm);
    if (headings) {
      headings.forEach((heading, index) => {
        const title = heading.replace(/^#+\s/, '').trim();
        const slug = title.toLowerCase().replace(/[^\w]+/g, '-');
        markdown += `${index + 1}. [${title}](#${slug})\n`;
      });
    }
    markdown += '\n';

    // Append content
    markdown += markdownContent + '\n\n';

    return {
      content: markdown,
      images: images
    };
  } catch (error) {
    console.error('Error converting ODT to Markdown:', error);
    throw error;
  }
}

/**
 * Extracts text from parsed ODT XML.
 * @param {Object} parsedXml - Parsed XML object.
 * @returns {string} - Extracted text as HTML.
 */
function extractTextFromODT(parsedXml) {
  const body = parsedXml['office:document-content']['office:body'][0]['office:text'][0];
  let html = '';

  function traverse(element) {
    if (typeof element === 'string') {
      html += element;
    } else if (Array.isArray(element)) {
      element.forEach(traverse);
    } else if (typeof element === 'object') {
      for (const key in element) {
        const items = element[key];
        items.forEach(item => {
          switch (key) {
            case 'text:p':
              html += `<p>${processParagraph(item)}</p>`;
              break;
            case 'text:h':
              const level = parseInt(item.$['text:outline-level'], 10) || 1;
              html += `<h${level}>${processParagraph(item)}</h${level}>\n`;
              break;
            case 'draw:frame':
              // Handle images
              const imageHref = item['draw:image'][0].$['xlink:href']; // Corrected Syntax
              if (imageHref) {
                const href = imageHref.replace('#', '');
                html += `<img src="${href}" alt="Image"/>`;
              }
              break;
            default:
              traverse(item);
          }
        });
      }
    }
  }

  function processParagraph(paragraph) {
    let text = '';
    if (paragraph['text:span']) {
      paragraph['text:span'].forEach(span => {
        if (span['text:a']) {
          // Handle links
          const href = span['text:a'][0].$['xlink:href'] || '#'; // Corrected Syntax
          const spanText = span['_'] || '';
          text += `[${spanText}](${href})`;
        } else {
          text += span['_'] || '';
        }
      });
    }
    return text;
  }

  traverse(body);
  return html;
}
