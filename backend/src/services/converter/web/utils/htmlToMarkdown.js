/**
 * HTML to Markdown Converter Module
 * 
 * This module provides functionality for converting HTML to Markdown format.
 * It includes methods for processing different HTML elements and generating
 * well-formatted Markdown output.
 * 
 * Related files:
 * - ../urlConverter.js: Main URL converter implementation
 * - ./config.js: Configuration settings
 * - ./spaHandler.js: SPA detection and handling
 * - ./contentExtractor.js: Content extraction logic
 */

import { JSDOM } from 'jsdom';
import { formatMetadata } from '../../../../utils/metadataExtractor.js';
import { AppError } from '../../../../utils/errorHandler.js';

/**
 * Generates Markdown from HTML content
 * @param {string} content - HTML content
 * @param {Object} metadata - Page metadata
 * @param {Array} images - Images to include
 * @param {string} url - Original URL
 * @param {Object} options - Conversion options
 * @returns {Promise<string>} - Markdown content
 */
export async function generateMarkdown(content, metadata, images, url, options) {
  try {
    // Create a new JSDOM instance with the content
    const dom = new JSDOM(content);
    const document = dom.window.document;
    
    // Convert the content to Markdown
    let markdown = '';
    
    // Add metadata as YAML frontmatter
    if (options.includeMeta && Object.keys(metadata).length > 0) {
      markdown += '---\n';
      markdown += formatMetadata(metadata);
      markdown += `url: ${url}\n`;
      markdown += `date_scraped: ${new Date().toISOString()}\n`;
      markdown += '---\n\n';
    }
    
    // Add title
    const title = metadata.title || document.title || extractTitleFromDocument(document) || '';
    if (title) {
      markdown += `# ${title}\n\n`;
    }
    
    // Process the document to convert HTML to Markdown
    markdown += htmlToMarkdown(document.body);
    
    // Add images at the end if they weren't already included
    if (options.includeImages && images.length > 0) {
      const imageMarkdown = generateImagesSection(images);
      if (imageMarkdown && !markdown.includes(imageMarkdown)) {
        markdown += '\n\n## Images\n\n';
        markdown += imageMarkdown;
      }
    }
    
    // Add source URL at the end
    markdown += `\n\n---\n\nSource: [${url}](${url})\n`;
    
    return markdown;
  } catch (error) {
    console.error('Error generating Markdown:', error);
    throw new AppError(`Failed to generate Markdown: ${error.message}`, 500);
  }
}

/**
 * Extracts title from document
 * @param {Document} document - DOM document
 * @returns {string} - Extracted title
 */
function extractTitleFromDocument(document) {
  // Try to find the first h1
  const h1 = document.querySelector('h1');
  if (h1 && h1.textContent.trim()) {
    return h1.textContent.trim();
  }
  
  // If no h1, try the title tag
  const title = document.querySelector('title');
  if (title && title.textContent.trim()) {
    return title.textContent.trim();
  }
  
  // If no title, try the first h2
  const h2 = document.querySelector('h2');
  if (h2 && h2.textContent.trim()) {
    return h2.textContent.trim();
  }
  
  return '';
}

/**
 * Generates Markdown for images
 * @param {Array} images - Images to include
 * @returns {string} - Markdown for images
 */
function generateImagesSection(images) {
  if (!images || images.length === 0) return '';
  
  let markdown = '';
  
  // Add each image
  images.forEach(img => {
    const alt = img.alt || '';
    const title = img.title ? ` "${img.title}"` : '';
    markdown += `![${alt}](${img.src}${title})\n\n`;
  });
  
  return markdown;
}

/**
 * Converts HTML to Markdown
 * @param {HTMLElement} element - HTML element to convert
 * @returns {string} - Markdown content
 */
export function htmlToMarkdown(element) {
  if (!element) return '';
  
  let markdown = '';
  
  // Process each child node
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 3) { // Text node
      // Clean up text nodes (remove excessive whitespace)
      const text = node.textContent.replace(/\s+/g, ' ');
      markdown += text;
    } else if (node.nodeType === 1) { // Element node
      const tagName = node.tagName.toLowerCase();
      
      switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          const level = parseInt(tagName.substring(1), 10);
          markdown += `\n\n${'#'.repeat(level)} ${node.textContent.trim()}\n\n`;
          break;
          
        case 'p':
          const pContent = htmlToMarkdown(node);
          if (pContent.trim()) {
            markdown += `\n\n${pContent.trim()}\n\n`;
          }
          break;
          
        case 'br':
          markdown += '\n';
          break;
          
        case 'strong':
        case 'b':
          markdown += `**${htmlToMarkdown(node)}**`;
          break;
          
        case 'em':
        case 'i':
          markdown += `*${htmlToMarkdown(node)}*`;
          break;
          
        case 'a':
          const href = node.getAttribute('href');
          if (href) {
            const text = htmlToMarkdown(node).trim() || href;
            markdown += `[${text}](${href})`;
          } else {
            markdown += htmlToMarkdown(node);
          }
          break;
          
        case 'img':
          const src = node.getAttribute('src');
          const alt = node.getAttribute('alt') || '';
          const title = node.getAttribute('title') || '';
          if (src) {
            if (title) {
              markdown += `![${alt}](${src} "${title}")`;
            } else {
              markdown += `![${alt}](${src})`;
            }
          }
          break;
          
        case 'ul':
          markdown += '\n\n';
          // Process nested lists properly
          for (const li of Array.from(node.children)) {
            if (li.tagName.toLowerCase() === 'li') {
              markdown += `* ${processListItem(li)}\n`;
            }
          }
          markdown += '\n';
          break;
          
        case 'ol':
          markdown += '\n\n';
          // Process nested lists properly
          Array.from(node.children).forEach((li, index) => {
            if (li.tagName.toLowerCase() === 'li') {
              markdown += `${index + 1}. ${processListItem(li)}\n`;
            }
          });
          markdown += '\n';
          break;
          
        case 'blockquote':
          const quoteContent = htmlToMarkdown(node).trim();
          if (quoteContent) {
            markdown += '\n\n> ';
            markdown += quoteContent.split('\n').join('\n> ');
            markdown += '\n\n';
          }
          break;
          
        case 'pre':
          // Try to detect language from class
          let language = '';
          const classAttr = node.getAttribute('class') || '';
          const codeElement = node.querySelector('code');
          const codeClass = codeElement ? codeElement.getAttribute('class') || '' : '';
          
          // Check for language classes like "language-javascript" or "brush: js"
          const langMatch = (classAttr + ' ' + codeClass).match(/(?:language|lang|brush)[-:\s](\w+)/i);
          if (langMatch) {
            language = langMatch[1].toLowerCase();
          }
          
          // Get the code content from either the code element or the pre element
          const codeContent = codeElement ? codeElement.textContent : node.textContent;
          
          markdown += `\n\n\`\`\`${language}\n`;
          markdown += codeContent.trim();
          markdown += `\n\`\`\`\n\n`;
          break;
          
        case 'code':
          // Don't process code inside pre (already handled above)
          if (node.parentElement && node.parentElement.tagName.toLowerCase() !== 'pre') {
            markdown += `\`${node.textContent}\``;
          }
          break;
          
        case 'hr':
          markdown += '\n\n---\n\n';
          break;
          
        case 'table':
          markdown += convertTableToMarkdown(node);
          break;
          
        case 'div':
          // For divs, we want to add spacing only if they appear to be block-level
          const divContent = htmlToMarkdown(node);
          if (divContent.trim()) {
            // Check if the div has block styling
            const display = node.style.display;
            if (display === 'block' || display === 'flex' || display === 'grid') {
              markdown += `\n\n${divContent.trim()}\n\n`;
            } else {
              markdown += divContent;
            }
          }
          break;
          
        default:
          // For other elements, just process their children
          markdown += htmlToMarkdown(node);
      }
    }
  }
  
  return markdown;
}

/**
 * Process a list item, handling nested lists properly
 * @param {HTMLElement} li - List item element
 * @returns {string} - Processed list item content
 */
function processListItem(li) {
  let content = '';
  
  // Process each child node
  for (const node of Array.from(li.childNodes)) {
    if (node.nodeType === 3) { // Text node
      content += node.textContent;
    } else if (node.nodeType === 1) { // Element node
      const tagName = node.tagName.toLowerCase();
      
      if (tagName === 'ul') {
        // Handle nested unordered list
        content += '\n';
        for (const nestedLi of Array.from(node.children)) {
          if (nestedLi.tagName.toLowerCase() === 'li') {
            content += `  * ${processListItem(nestedLi)}\n`;
          }
        }
      } else if (tagName === 'ol') {
        // Handle nested ordered list
        content += '\n';
        Array.from(node.children).forEach((nestedLi, index) => {
          if (nestedLi.tagName.toLowerCase() === 'li') {
            content += `  ${index + 1}. ${processListItem(nestedLi)}\n`;
          }
        });
      } else {
        // Process other elements
        content += htmlToMarkdown(node);
      }
    }
  }
  
  return content.trim();
}

/**
 * Converts an HTML table to Markdown
 * @param {HTMLElement} table - Table element
 * @returns {string} - Markdown table
 */
function convertTableToMarkdown(table) {
  if (!table) return '';
  
  try {
    let markdown = '\n\n';
    const rows = Array.from(table.querySelectorAll('tr'));
    
    if (rows.length === 0) return '';
    
    // Process header row
    const headerRow = rows[0];
    const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
    
    if (headerCells.length === 0) return '';
    
    // Create header row
    markdown += '| ' + headerCells.map(cell => cell.textContent.trim()).join(' | ') + ' |\n';
    
    // Create separator row
    markdown += '| ' + headerCells.map(() => '---').join(' | ') + ' |\n';
    
    // Process data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cells = Array.from(row.querySelectorAll('td, th'));
      
      if (cells.length === 0) continue;
      
      // Pad cells array to match header length if needed
      while (cells.length < headerCells.length) {
        cells.push({ textContent: '' });
      }
      
      // Create data row
      markdown += '| ' + cells.map(cell => {
        // Clean cell content (remove newlines, etc.)
        return cell.textContent.trim().replace(/\n/g, ' ');
      }).join(' | ') + ' |\n';
    }
    
    markdown += '\n';
    return markdown;
  } catch (error) {
    console.error('Error converting table to Markdown:', error);
    return '\n\n[Table conversion failed]\n\n';
  }
}

/**
 * Cleans up Markdown content
 * @param {string} markdown - Markdown content to clean
 * @returns {string} - Cleaned Markdown content
 */
export function cleanMarkdown(markdown) {
  if (!markdown) return '';
  
  // Replace multiple consecutive blank lines with a single blank line
  let cleaned = markdown.replace(/\n{3,}/g, '\n\n');
  
  // Fix list item spacing
  cleaned = cleaned.replace(/\n\n(\s*[-*+])/g, '\n$1');
  cleaned = cleaned.replace(/\n\n(\s*\d+\.)/g, '\n$1');
  
  // Fix blockquote spacing
  cleaned = cleaned.replace(/\n\n(\s*>)/g, '\n$1');
  
  // Fix heading spacing
  cleaned = cleaned.replace(/\n{3,}(#{1,6}\s)/g, '\n\n$1');
  
  // Fix code block spacing
  cleaned = cleaned.replace(/\n{3,}(```)/g, '\n\n$1');
  
  // Fix horizontal rule spacing
  cleaned = cleaned.replace(/\n{3,}(---)/g, '\n\n$1');
  
  // Fix table spacing
  cleaned = cleaned.replace(/\n{3,}(\|)/g, '\n\n$1');
  
  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

export default {
  generateMarkdown,
  htmlToMarkdown,
  cleanMarkdown
};
