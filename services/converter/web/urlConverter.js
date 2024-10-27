// services/converter/web/urlConverter.js

import puppeteer from 'puppeteer';
import TurndownService from 'turndown';
import * as cheerio from 'cheerio';
import path from 'path';

/**
 * Cleans up HTML content before conversion
 * @param {CheerioStatic} $ - Cheerio instance
 */
function cleanupContent($) {
  // Remove unwanted elements
  $('script').remove();
  $('style').remove();
  $('link').remove();
  $('meta').remove();
  $('noscript').remove();
  $('iframe').remove();
  $('.hidden').remove();
  $('[style*="display: none"]').remove();
  $('[style*="display:none"]').remove();
  $('[hidden]').remove();

  // Remove all CSS classes and IDs
  $('*').removeAttr('class').removeAttr('id');

  // Remove empty elements
  $('p:empty').remove();
  $('div:empty').remove();

  // Remove tracking and advertisement elements
  $('[data-ad]').remove();
  $('[id*="google"]').remove();
  $('[class*="advert"]').remove();
  $('[class*="tracking"]').remove();
  $('[aria-hidden="true"]').remove();
}

/**
 * Extracts main content from HTML
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {string} - Clean HTML content
 */
function extractMainContent($) {
  // Try to find main content container
  const possibleContentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '.content',
    '#content',
    '.post-content',
    '.article-content'
  ];

  let mainContent = null;

  // Try each selector until we find content
  for (const selector of possibleContentSelectors) {
    const element = $(selector);
    if (element.length && element.text().trim().length > 100) {
      mainContent = element;
      break;
    }
  }

  // If no main content found, use body
  if (!mainContent) {
    mainContent = $('body');
  }

  return mainContent;
}

/**
 * Converts a URL to Markdown format
 * @param {string} url - The URL to convert
 * @param {string} originalName - Original identifier
 * @returns {Promise<{ content: string, images: Array }>}
 */
export async function convertUrlToMarkdown(url, originalName) {
  let browser;
  try {
    console.log(`Starting conversion for URL: ${url}`);

    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Puppeteer launched successfully');

    const page = await browser.newPage();
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    console.log(`Navigated to URL: ${url}`);

    const content = await page.content();
    console.log('Page content retrieved');

    const $ = cheerio.load(content);
    cleanupContent($);
    console.log('Content cleaned up');

    const mainContent = extractMainContent($);
    if (!mainContent || mainContent.text().trim().length === 0) {
      throw new Error('Main content extraction failed or resulted in empty content');
    }
    console.log('Main content extracted successfully');

    // Process images
    const images = [];
    mainContent.find('img').each((index, img) => {
      const src = $(img).attr('src');
      const alt = $(img).attr('alt') || `Image ${index + 1}`;
      
      if (src) {
        if (src.startsWith('data:')) {
          // Handle Base64 images
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

            // Update image source in content
            $(img).attr('src', `attachments/${path.basename(originalName, path.extname(originalName))}/${imageName}`);
          }
        } else {
          // Handle external images
          console.warn(`External image found but not handled: ${src}`);
          // Optionally, implement downloading external images here
        }
      }
    });
    console.log(`Processed ${images.length} images`);

    // Configure Turndown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      strongDelimiter: '**',
      bulletListMarker: '-'
    });

    // Add custom rules
    turndownService.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: content => `~~${content}~~`
    });

    // Convert to Markdown
    let markdown = turndownService.turndown(mainContent.html());
    console.log('Content converted to Markdown');

    // Add metadata
    const metadataMarkdown = [
      `# ${$('title').text() || new URL(url).hostname}`,
      '',
      $('meta[name="description"]').attr('content') ? `> ${$('meta[name="description"]').attr('content')}` : '',
      '',
      `**Source:** [${url}](${url})`,
      '',
      '---',
      ''
    ].filter(Boolean).join('\n');

    markdown = metadataMarkdown + markdown;
    console.log('Metadata added to Markdown content');

    return {
      content: markdown,
      images: images
    };

  } catch (error) {
    console.error('Error converting URL to Markdown:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Puppeteer browser closed');
    }
  }
}
