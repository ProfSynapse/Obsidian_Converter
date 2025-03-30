/**
 * URL Processor Module
 * Handles processing URLs and generating content from them
 */

import pLimit from 'p-limit';
import { AppError } from '../../../../utils/errorHandler.js';
import { convertUrlToMarkdown } from '../urlConverter.js';

/**
 * Format metadata as YAML frontmatter
 * @param {Object} metadata - Metadata object
 * @returns {string} YAML frontmatter
 */
function formatMetadata(metadata) {
  const lines = ['---'];

  // Filter out any image-related metadata
  const cleanedMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !key.toLowerCase().includes('image'))
  );

  for (const [key, value] of Object.entries(cleanedMetadata)) {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        lines.push(`${key}:`);
        value.forEach(item => lines.push(`  - ${item}`));
      }
    } else if (value !== null && value !== undefined && value !== '') {
      // Escape special characters and wrap values containing special chars in quotes
      const needsQuotes = /[:#\[\]{}",\n]/g.test(value.toString());
      const escapedValue = value.toString().replace(/"/g, '\\"');
      lines.push(`${key}: ${needsQuotes ? `"${escapedValue}"` : value}`);
    }
  }

  lines.push('---\n');
  return lines.join('\n');
}

export class UrlProcessor {
  constructor(config = { concurrentLimit: 30 }) {
    this.config = config;
  }

  /**
   * Process a list of URLs in chunks
   * @param {Array} urls - List of URLs to process
   * @param {Object} finder - URL finder instance
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} Array of processed URL results
   */
  async processUrlsInChunks(urls, finder, options = {}) {
    const limit = pLimit(this.config.concurrentLimit);
    const results = [];
    const processedUrls = new Set(); // Track processed URLs to avoid duplicates

    for (const normalizedUrl of urls) {
      try {
        // Get the original URL for fetching
        const url = finder.getOriginalUrl(normalizedUrl);
        
        // Skip if we've already processed this normalized URL
        if (processedUrls.has(normalizedUrl)) {
          console.log(`⏭️ Skipping duplicate URL: ${url}`);
          continue;
        }
        
        processedUrls.add(normalizedUrl);
        
        const conversionOptions = {
          ...options,
          includeImages: true,
          includeMeta: true,
          handleDynamicContent: options.handleDynamicContent !== false
        };
        
        // Pass the browser instance to child URL conversions
        if (finder.externalBrowser) {
          conversionOptions.browser = finder.externalBrowser;
        }

        const result = await limit(async () => {
          const convertResult = await convertUrlToMarkdown(url, conversionOptions);
          const urlPath = new URL(url).pathname || '/';
          const name = this.sanitizeFilename(urlPath);
          
          return {
            success: true,
            name: `${name}.md`,
            content: convertResult.content,
            rawContent: convertResult.content, // Store raw content without frontmatter
            images: convertResult.images || [],
            url,
            normalizedUrl,
            metadata: {
              ...convertResult.metadata,
              url: url,
              date_scraped: new Date().toISOString()
            }
          };
        });

        console.log(`✅ Converted: ${url}`);
        results.push(result);

      } catch (error) {
        console.log(`❌ Failed to convert: ${finder.getOriginalUrl(normalizedUrl)}`);
        results.push({ 
          success: false, 
          url: finder.getOriginalUrl(normalizedUrl),
          normalizedUrl,
          error: error.message 
        });
      }
    }

    return results;
  }

  /**
   * Sanitize a filename
   * @param {string} input - Input string
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(input) {
    if (!input) return 'index';
    
    const parts = input.split('/').filter(Boolean);
    const lastPart = parts.pop() || 'index';
    
    return lastPart
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .split('?')[0]
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .split('-')
      .reduce((acc, part) => {
        if ((acc + (acc ? '-' : '') + part).length <= 100) {
          return acc + (acc ? '-' : '') + part;
        }
        return acc;
      }, '') || 'index';
  }

  /**
   * Generate an index page for a list of pages
   * @param {string} parentUrl - Parent URL
   * @param {Array} pages - List of pages
   * @param {string} hostname - Hostname
   * @returns {Object} Index page content and metadata
   */
  generateIndex(parentUrl, pages, hostname) {
    const successfulPages = pages.filter(p => p.success);
    const failedPages = pages.filter(p => !p.success);
    const timestamp = new Date().toISOString();
    
    let cleanHostname = hostname;
    if (cleanHostname.startsWith('temp_')) {
      cleanHostname = cleanHostname.replace(/^temp_\d+_/, '');
    }

    // Group pages by sections
    const sections = new Map();
    const processedPaths = new Set(); // Track processed paths to avoid duplicates
    
    successfulPages.forEach(page => {
      try {
        const url = new URL(page.url);
        const pathParts = url.pathname.split('/').filter(Boolean);
        const section = pathParts[0] || 'main';
        
        if (!sections.has(section)) {
          sections.set(section, []);
        }
        
        // Create a unique path key
        const pathKey = url.pathname;
        
        // Skip if we've already processed this path
        if (processedPaths.has(pathKey)) {
          return;
        }
        
        processedPaths.add(pathKey);
        sections.get(section).push(page);
      } catch (error) {
        console.error('Error processing page section:', error);
      }
    });

    // Generate index content without frontmatter
    const content = [
      `# ${cleanHostname} Website Archive`,
      '',
      '## Site Information',
      `- **Source URL:** ${parentUrl}`,
      `- **Archived:** ${timestamp}`,
      `- **Total Pages:** ${pages.length}`,
      `- **Successful:** ${successfulPages.length}`,
      `- **Failed:** ${failedPages.length}`,
      '',
      '## Successfully Converted Pages',
      '',
      ...Array.from(sections.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([section, sectionPages]) => [
          `### ${section.charAt(0).toUpperCase() + section.slice(1)}`,
          '',
          ...sectionPages.map(page => {
            const name = page.name.replace(/\.md$/, '');
            return `- [[pages/${name}|${name}]] - [Original](${page.url})`;
          }),
          ''
        ].join('\n')),
      '',
      failedPages.length ? [
        '## Failed Conversions',
        '',
        ...failedPages.map(page => `- ${page.url}: ${page.error}`),
        ''
      ].join('\n') : ''
    ].join('\n');

    // Return metadata separately
    const metadata = {
      title: `${cleanHostname} Archive`,
      description: `Website archive of ${cleanHostname}`,
      date: timestamp,
      source: parentUrl,
      archived_at: timestamp,
      page_count: successfulPages.length,
      tags: [
        'website-archive',
        hostname.replace(/\./g, '-')
      ]
    };

    return { content, metadata };
  }
  
  /**
   * Add frontmatter to page content
   * @param {Object} page - Page object
   * @returns {Object} Page with frontmatter
   */
  addFrontmatterToPage(page) {
    if (!page.success) return page;
    
    // Create metadata for the page
    const pageMetadata = {
      type: 'url',
      converted: new Date().toISOString(),
      ...page.metadata,
      pageCount: 1
    };
    
    // Add frontmatter to content
    const contentWithFrontmatter = formatMetadata(pageMetadata) + page.rawContent;
    
    return {
      ...page,
      content: contentWithFrontmatter
    };
  }
}
