/**
 * HTML to Markdown Converter Module
 */

import { JSDOM } from 'jsdom';

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
    console.log('Starting markdown generation...');
    
    // Check if content is valid
    if (!content || content.length < 10) {
      console.error('Invalid content received for markdown generation:', content);
      return `# ${metadata.title || 'Page Content'}\n\nNo content could be extracted from this page.`;
    }
    
    console.log(`Content length before cleaning: ${content.length}`);
    
    // Clean up content before parsing
    content = cleanHtmlContent(content);
    
    console.log(`Content length after cleaning: ${content.length}`);
    console.log(`Content preview after cleaning: ${content.substring(0, 200)}...`);
    
    // Create a new JSDOM instance with the content
    const dom = new JSDOM(content, {
      contentType: 'text/html',
      includeNodeLocations: true,
      runScripts: 'outside-only'
    });
    const document = dom.window.document;
    
    // Check if document is valid
    if (!document) {
      console.error('Invalid document after JSDOM parsing');
      return `# ${metadata.title || 'Page Content'}\n\nFailed to parse page content.`;
    }
    
    // If document.body is null, try to create it
    if (!document.body) {
      console.warn('Document body is null, trying to fix...');
      
      // Try to extract the body content from the HTML string
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch && bodyMatch[1]) {
        console.log('Found body content in HTML string, creating body element');
        
        // Create a body element and set its innerHTML
        const bodyElement = document.createElement('body');
        bodyElement.innerHTML = bodyMatch[1];
        
        // Append the body to the document if it doesn't exist
        if (!document.documentElement) {
          const html = document.createElement('html');
          document.appendChild(html);
          html.appendChild(bodyElement);
        } else {
          document.documentElement.appendChild(bodyElement);
        }
      } else {
        console.error('Could not find body content in HTML string');
        
        // Create a minimal body with the content
        const bodyElement = document.createElement('body');
        bodyElement.innerHTML = content;
        
        // Append the body to the document
        if (!document.documentElement) {
          const html = document.createElement('html');
          document.appendChild(html);
          html.appendChild(bodyElement);
        } else {
          document.documentElement.appendChild(bodyElement);
        }
      }
    }
    
    // Double check if document.body exists now
    if (!document.body) {
      console.error('Failed to create document body');
      return `# ${metadata.title || 'Page Content'}\n\nFailed to parse page content.`;
    }
    
    // Remove script and style elements
    removeUnwantedElements(document);
    
    // Convert the content to Markdown
    let markdown = '';
    
    // Add title
    let title = metadata.title || document.title || extractTitleFromDocument(document) || '';
    if (title.startsWith('temp_')) {
      title = title.replace(/^temp_\d+_/, '');
    }
    
    if (title) {
      markdown += `# ${title}\n\n`;
    }
    
    // Process the document body
    console.log('Processing document body...');
    let processedContent = '';
    
    try {
      if (document.body) {
        processedContent = htmlToMarkdown(document.body);
        console.log(`Processed content length: ${processedContent.length}`);
        console.log(`Processed content preview: ${processedContent.substring(0, 200)}...`);
      } else {
        console.error('Document body is null');
        processedContent = 'No content could be extracted.';
      }
    } catch (error) {
      console.error('Error processing document body:', error);
      processedContent = 'Error processing content: ' + error.message;
    }

    // Map to store image source to URL mappings
    const imageMap = new Map(images.map(img => [img.src, img]));

    // Replace image references
    processedContent = processedContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
      // Look up the image in our map
      const image = imageMap.get(src);
      if (image) {
        return `![[${src}]]`;
      }
      return match;
    });

    markdown += processedContent;
    
    // Clean up the final markdown
    markdown = cleanMarkdown(markdown);
    
    // Remove any remaining JavaScript-like content
    markdown = removeJavaScriptContent(markdown);
    
    console.log(`Final markdown length: ${markdown.length}`);
    console.log(`Final markdown preview: ${markdown.substring(0, 200)}...`);
    
    // If markdown is too short, it might indicate a problem
    if (markdown.length < 50) {
      console.warn('Generated markdown is very short, might indicate a problem');
      // Add a fallback message
      markdown += `\n\nNote: Limited content was extracted from ${url}. You may want to visit the original page for more information.`;
    }

    return markdown;
  } catch (error) {
    console.error('Error generating Markdown:', error);
    throw new Error(`Failed to generate Markdown: ${error.message}`);
  }
}

/**
 * Clean HTML content before parsing
 * @private
 */
function cleanHtmlContent(content) {
  if (!content) return '';
  
  // Remove script tags and their content
  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove style tags and their content
  content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove inline JavaScript
  content = content.replace(/\bon\w+\s*=\s*["'].*?["']/gi, '');
  
  // Remove JavaScript variable assignments
  content = content.replace(/window\.__[^;]+;/g, '');
  content = content.replace(/var\s+\w+\s*=\s*{[^}]+};/g, '');
  content = content.replace(/const\s+\w+\s*=\s*{[^}]+};/g, '');
  content = content.replace(/let\s+\w+\s*=\s*{[^}]+};/g, '');
  
  // Remove JSON-like data structures
  content = content.replace(/\{"\w+":(?:[^}]+|\{[^}]+\})+\}/g, '');
  
  // Remove HTML comments
  content = content.replace(/<!--[\s\S]*?-->/g, '');
  
  return content;
}

/**
 * Remove unwanted elements from the DOM
 * @private
 */
function removeUnwantedElements(document) {
  // Remove all script tags
  const scripts = document.querySelectorAll('script');
  scripts.forEach(script => script.remove());
  
  // Remove all style tags
  const styles = document.querySelectorAll('style');
  styles.forEach(style => style.remove());
  
  // Remove all noscript tags
  const noscripts = document.querySelectorAll('noscript');
  noscripts.forEach(noscript => noscript.remove());
  
  // Remove all iframe tags
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach(iframe => iframe.remove());
  
  // Remove cookie notices and consent banners using comprehensive selectors
  const cookieSelectors = [
    // Generic patterns
    '[id*="cookie"]', '[class*="cookie"]',
    '[id*="consent"]', '[class*="consent"]',
    '[id*="gdpr"]', '[class*="gdpr"]',
    // Specific vendor implementations
    '#onetrust-banner-sdk',
    '#onetrust-consent-sdk',
    '#cookiebanner',
    '#cookie-banner',
    '#cookie-notice',
    '#cookie-law-info-bar',
    '#cookie-consent',
    '.cookie-consent',
    // Overlay patterns
    '.modal[aria-label*="cookie"]',
    '.dialog[aria-label*="cookie"]',
    '[role="dialog"][aria-label*="cookie"]',
    // Button patterns
    '#onetrust-accept-btn-handler',
    '#accept-cookie-consent',
    '[id*="accept-cookies"]',
    '[id*="accept-cookie"]',
    '.accept-cookies',
    '.accept-cookie'
  ];
  const cookieElements = document.querySelectorAll(cookieSelectors.join(', '));
  cookieElements.forEach(el => {
    try {
      // Check if element is visible and positioned as an overlay
      const style = el.ownerDocument.defaultView.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'absolute' || 
          parseInt(style.zIndex, 10) > 100 || el.matches('[role="dialog"]')) {
        el.remove();
      }
    } catch (e) {
      // If we can't check styles, remove it anyway
      el.remove();
    }
  });
  
  // Remove HubSpot specific elements
  const hubspotElements = document.querySelectorAll('[class*="hs-"], [id*="hs-"], [data-hs-]');
  hubspotElements.forEach(el => el.remove());
}

/**
 * Remove JavaScript-like content from markdown
 * @private
 */
function removeJavaScriptContent(markdown) {
  if (!markdown) return '';
  
  // Remove window.__* assignments
  markdown = markdown.replace(/window\.__[\s\S]*?;/g, '');
  
  // Remove var/const/let assignments
  markdown = markdown.replace(/(?:var|const|let)\s+\w+\s*=[\s\S]*?;/g, '');
  
  // Remove document.* calls
  markdown = markdown.replace(/document\.[\s\S]*?;/g, '');
  
  // Remove JSON-like structures
  markdown = markdown.replace(/\{\s*"[^"]+"\s*:[\s\S]*?\}/g, '');
  
  // Remove any lines that are just JavaScript-like code
  const lines = markdown.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    // Skip lines that look like JavaScript
    if (/^(?:window|document|var|const|let|function)\.\w+/.test(trimmed)) return false;
    if (/^[a-zA-Z$_][a-zA-Z0-9$_]*\s*=/.test(trimmed)) return false;
    if (/^if\s*\(/.test(trimmed)) return false;
    if (/^for\s*\(/.test(trimmed)) return false;
    if (/^while\s*\(/.test(trimmed)) return false;
    if (/^switch\s*\(/.test(trimmed)) return false;
    if (/^try\s*\{/.test(trimmed)) return false;
    if (/^catch\s*\(/.test(trimmed)) return false;
    if (/^finally\s*\{/.test(trimmed)) return false;
    if (/^}\s*else\s*\{/.test(trimmed)) return false;
    if (/^}\s*else\s+if\s*\(/.test(trimmed)) return false;
    if (/^}\s*$/.test(trimmed) && lines[lines.indexOf(line) - 1]?.trim().endsWith('{')) return false;
    
    return true;
  });
  
  return filteredLines.join('\n');
}

/**
 * Extracts title from document
 * @private
 */
function extractTitleFromDocument(document) {
  const h1 = document.querySelector('h1');
  if (h1 && h1.textContent.trim()) {
    return h1.textContent.trim();
  }
  
  const title = document.querySelector('title');
  if (title && title.textContent.trim()) {
    return title.textContent.trim();
  }
  
  const h2 = document.querySelector('h2');
  if (h2 && h2.textContent.trim()) {
    return h2.textContent.trim();
  }
  
  return '';
}

/**
 * Converts HTML to Markdown
 * @private
 */
export function htmlToMarkdown(element) {
  if (!element) return '';
  
  let markdown = '';
  
  // Process each child node
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 3) { // Text node
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
          if (src) {
            markdown += `![${alt}](${src})`;
          }
          break;
          
        case 'ul':
          markdown += '\n\n';
          for (const li of Array.from(node.children)) {
            if (li.tagName.toLowerCase() === 'li') {
              markdown += `* ${processListItem(li)}\n`;
            }
          }
          markdown += '\n';
          break;
          
        case 'ol':
          markdown += '\n\n';
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
          let language = '';
          const classAttr = node.getAttribute('class') || '';
          const codeElement = node.querySelector('code');
          const codeClass = codeElement ? codeElement.getAttribute('class') || '' : '';
          
          const langMatch = (classAttr + ' ' + codeClass).match(/(?:language|lang|brush)[-:\s](\w+)/i);
          if (langMatch) {
            language = langMatch[1].toLowerCase();
          }
          
          const codeContent = codeElement ? codeElement.textContent : node.textContent;
          
          markdown += `\n\n\`\`\`${language}\n`;
          markdown += codeContent.trim();
          markdown += `\n\`\`\`\n\n`;
          break;
          
        case 'code':
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
          const divContent = htmlToMarkdown(node);
          if (divContent.trim()) {
            const display = node.style.display;
            if (display === 'block' || display === 'flex' || display === 'grid') {
              markdown += `\n\n${divContent.trim()}\n\n`;
            } else {
              markdown += divContent;
            }
          }
          break;
          
        default:
          markdown += htmlToMarkdown(node);
      }
    }
  }
  
  return markdown;
}

/**
 * Process a list item, handling nested lists properly
 * @private
 */
function processListItem(li) {
  let content = '';
  
  for (const node of Array.from(li.childNodes)) {
    if (node.nodeType === 3) { // Text node
      content += node.textContent;
    } else if (node.nodeType === 1) { // Element node
      const tagName = node.tagName.toLowerCase();
      
      if (tagName === 'ul') {
        content += '\n';
        for (const nestedLi of Array.from(node.children)) {
          if (nestedLi.tagName.toLowerCase() === 'li') {
            content += `  * ${processListItem(nestedLi)}\n`;
          }
        }
      } else if (tagName === 'ol') {
        content += '\n';
        Array.from(node.children).forEach((nestedLi, index) => {
          if (nestedLi.tagName.toLowerCase() === 'li') {
            content += `  ${index + 1}. ${processListItem(nestedLi)}\n`;
          }
        });
      } else {
        content += htmlToMarkdown(node);
      }
    }
  }
  
  return content.trim();
}

/**
 * Converts an HTML table to Markdown
 * @private
 */
function convertTableToMarkdown(table) {
  if (!table) return '';
  
  try {
    let markdown = '\n\n';
    const rows = Array.from(table.querySelectorAll('tr'));
    
    if (rows.length === 0) return '';
    
    const headerRow = rows[0];
    const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
    
    if (headerCells.length === 0) return '';
    
    markdown += '| ' + headerCells.map(cell => cell.textContent.trim()).join(' | ') + ' |\n';
    markdown += '| ' + headerCells.map(() => '---').join(' | ') + ' |\n';
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cells = Array.from(row.querySelectorAll('td, th'));
      
      if (cells.length === 0) continue;
      
      while (cells.length < headerCells.length) {
        cells.push({ textContent: '' });
      }
      
      markdown += '| ' + cells.map(cell => {
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
  
  let cleaned = markdown.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/\n\n(\s*[-*+])/g, '\n$1');
  cleaned = cleaned.replace(/\n\n(\s*\d+\.)/g, '\n$1');
  cleaned = cleaned.replace(/\n\n(\s*>)/g, '\n$1');
  cleaned = cleaned.replace(/\n{3,}(#{1,6}\s)/g, '\n\n$1');
  cleaned = cleaned.replace(/\n{3,}(```)/g, '\n\n$1');
  cleaned = cleaned.replace(/\n{3,}(---)/g, '\n\n$1');
  cleaned = cleaned.replace(/\n{3,}(\|)/g, '\n\n$1');
  cleaned = cleaned.trim();
  
  return cleaned;
}

export default {
  generateMarkdown,
  htmlToMarkdown,
  cleanMarkdown
};
