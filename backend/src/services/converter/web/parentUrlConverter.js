/**
 * Parent URL Converter Module
 */

import puppeteer from 'puppeteer';
import pLimit from 'p-limit';
import { convertUrlToMarkdown } from './urlConverter.js';
import { AppError } from '../../../utils/errorHandler.js';
import { DEFAULT_PARENT_URL_CONVERTER_OPTIONS } from './utils/config.js';

// Browser instance cache to avoid launching multiple browsers
let browserInstance = null;

/**
 * Format metadata as YAML frontmatter
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

// Normalize URL by removing fragments and query parameters
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    urlObj.hash = ''; // Remove fragment
    return urlObj.origin + urlObj.pathname;
  } catch (error) {
    console.error('Error normalizing URL:', error);
    return url;
  }
}

class UrlFinder {
  constructor() {
    this.childUrls = new Set();
    this.normalizedUrlMap = new Map(); // Maps normalized URLs to original URLs
    this.externalBrowser = null;
    this.shouldCloseBrowser = false;
  }

  async getBrowser(externalBrowser = null) {
    // If an external browser is provided, use it
    if (externalBrowser) {
      this.externalBrowser = externalBrowser;
      return externalBrowser;
    }
    
    // If we already have an external browser, use it
    if (this.externalBrowser) {
      return this.externalBrowser;
    }
    
    // Otherwise, use or create the cached browser instance
    if (!browserInstance) {
      console.log('🌐 Launching new Puppeteer browser instance for parent URL conversion...');
      browserInstance = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1280,800'
        ]
      });
      
      // Set up event listeners
      browserInstance.on('disconnected', () => {
        console.log('🌐 Browser disconnected, clearing instance');
        browserInstance = null;
      });
      
      this.shouldCloseBrowser = true;
    }
    
    return browserInstance;
  }
  
  /**
   * Clean up the page by removing unwanted elements
   * @param {Page} page - Puppeteer page object
   */
  async cleanupPage(page) {
    try {
      // Remove script tags and their content
      await page.evaluate(() => {
        const elementsToRemove = [
          'script',
          'style',
          'noscript',
          'iframe',
          '[id*="cookie"]',
          '[class*="cookie"]',
          '[id*="consent"]',
          '[class*="consent"]',
          '[id*="popup"]',
          '[class*="popup"]',
          '[id*="banner"]',
          '[class*="banner"]',
          '[id*="modal"]',
          '[class*="modal"]',
          '[id*="dialog"]',
          '[class*="dialog"]',
          '[id*="overlay"]',
          '[class*="overlay"]',
          '[id*="notification"]',
          '[class*="notification"]',
          '[class*="hs-"]',
          '[id*="hs-"]',
          '[data-hs-]'
        ];
        
        elementsToRemove.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => el.remove());
        });
        
        // Remove inline JavaScript
        document.querySelectorAll('[onclick], [onload], [onunload], [onchange], [onsubmit], [onfocus], [onblur]').forEach(el => {
          el.removeAttribute('onclick');
          el.removeAttribute('onload');
          el.removeAttribute('onunload');
          el.removeAttribute('onchange');
          el.removeAttribute('onsubmit');
          el.removeAttribute('onfocus');
          el.removeAttribute('onblur');
        });
      });
      
      // Clean up JavaScript variable assignments in HTML
      await page.evaluate(() => {
        // Find and remove script blocks that set window variables
        const html = document.documentElement.outerHTML;
        const cleanedHtml = html.replace(/window\.__[^;]+;/g, '')
                               .replace(/var\s+\w+\s*=\s*{[^}]+};/g, '')
                               .replace(/const\s+\w+\s*=\s*{[^}]+};/g, '')
                               .replace(/let\s+\w+\s*=\s*{[^}]+};/g, '');
        
        // This is a bit of a hack, but it works to clean up the HTML
        if (html !== cleanedHtml) {
          document.open();
          document.write(cleanedHtml);
          document.close();
        }
      });
    } catch (error) {
      console.error('Error cleaning up page:', error);
      // Continue with extraction even if cleanup fails
    }
  }

  async findChildUrlsInChunks(parentUrl, chunkSize = 50) {
    let page = null;
    
    try {
      console.log(`🔍 Finding child pages for: ${parentUrl}`);
      
      // Get browser instance
      const browser = await this.getBrowser();
      
      // Create a new page
      page = await browser.newPage();
      
      // Set viewport
      await page.setViewport({ width: 1280, height: 800 });
      
      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );
      
      // Navigate to URL with timeout and wait for content to load
      await page.goto(parentUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Check if the page is an SPA and might need more time to load
      const isSPA = await this.detectSPA(page);
      
      // For SPAs, try waiting longer for content to load
      if (isSPA) {
        console.log('Detected SPA, waiting for more content to load...');
        await page.waitForTimeout(5000);
      }
      
      // Clean up the page before extracting links
      await this.cleanupPage(page);
      
      // Extract all links from the page
      const parentUrlObj = new URL(parentUrl);
      const urlMetadata = new Map();
      const urlPriorities = new Map();
      
      // Find all links on the page
      const links = await page.evaluate((parentHostname) => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => {
            try {
              const href = a.href;
              if (!href || href === '#' || href === '/' || 
                  href.startsWith('javascript:') || href.startsWith('mailto:') || 
                  href.startsWith('tel:')) {
                return null;
              }
              
              const url = new URL(href);
              if (url.hostname !== parentHostname) return null;
              
              return {
                url: href,
                text: a.textContent.trim(),
                isInNavigation: !!a.closest('nav, .nav, .menu, .navigation, header'),
                isInMain: !!a.closest('main, article, .content, #content'),
                pathDepth: url.pathname.split('/').filter(Boolean).length
              };
            } catch (e) {
              return null;
            }
          })
          .filter(Boolean);
      }, parentUrlObj.hostname);
      
      // Process links
      for (const link of links) {
        try {
          // Normalize URL to avoid duplicates
          const normalizedUrl = normalizeUrl(link.url);
          
          if (this.childUrls.has(normalizedUrl)) continue;
          if (this.shouldExcludeUrl(link.url)) continue;
          
          this.childUrls.add(normalizedUrl);
          this.normalizedUrlMap.set(normalizedUrl, link.url); // Store original URL
          
          // Store metadata for priority calculation
          urlMetadata.set(normalizedUrl, {
            ...link,
            normalizedUrl
          });
        } catch (error) {
          console.log(`⚠️ Skipping invalid URL: ${error.message}`);
        }
      }
      
      console.log(`🔍 Calculating priorities for ${urlMetadata.size} URLs...`);
      
      // Calculate priorities and organize into chunks
      const chunks = [];
      let currentChunk = [];
      
      for (const [normalizedUrl, metadata] of urlMetadata.entries()) {
        try {
          let priority = 50; // Base priority
          
          // Adjust based on location
          if (metadata.isInMain) priority += 30;
          if (metadata.isInNavigation) priority += 20;
          priority -= metadata.pathDepth * 5;
          
          // Adjust for home page and important sections
          const urlObj = new URL(metadata.url);
          if (urlObj.pathname === '/' || urlObj.pathname === '/index.html') {
            priority += 50;
          }
          if (/\/(about|contact|docs)/.test(urlObj.pathname)) {
            priority += 40;
          }
          
          urlPriorities.set(normalizedUrl, priority);
          currentChunk.push(normalizedUrl);
          
          if (currentChunk.length >= chunkSize) {
            currentChunk.sort((a, b) => (urlPriorities.get(b) || 0) - (urlPriorities.get(a) || 0));
            chunks.push([...currentChunk]);
            currentChunk = [];
          }
        } catch (error) {
          console.log(`⚠️ Error processing URL ${normalizedUrl}: ${error.message}`);
        }
      }

      if (currentChunk.length > 0) {
        currentChunk.sort((a, b) => (urlPriorities.get(b) || 0) - (urlPriorities.get(a) || 0));
        chunks.push([...currentChunk]);
      }

      // Log top URLs
      console.log(`🔝 Top 10 URLs by priority:`);
      Array.from(urlPriorities.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([normalizedUrl, priority]) => {
          console.log(`   ${priority}: ${this.normalizedUrlMap.get(normalizedUrl)}`);
        });

      console.log(`✅ Found ${this.childUrls.size} pages in ${chunks.length} chunks`);
      return chunks;

    } catch (error) {
      throw new AppError(`Failed to find child pages: ${error.message}`, 500);
    } finally {
      // Close the page but keep the browser instance
      if (page) {
        await page.close().catch(err => console.error('Error closing page:', err));
      }
    }
  }
  
  shouldExcludeUrl(url) {
    return DEFAULT_PARENT_URL_CONVERTER_OPTIONS.skipUrlPatterns.some(pattern => 
      pattern.test(url)
    );
  }

  async detectSPA(page) {
    try {
      return await page.evaluate(() => {
        const spaIndicators = [
          !!document.querySelector('#root'),
          !!document.querySelector('#app'),
          !!document.querySelector('#__next'),
          !!document.querySelector('#gatsby-focus-wrapper'),
          !!document.querySelector('[data-reactroot]'),
          !!document.querySelector('[data-react-app]'),
          !!document.querySelector('[ng-app]'),
          !!document.querySelector('[ng-controller]'),
          !!document.querySelector('[v-app]'),
          !!document.querySelector('[data-v-]'),
          document.querySelectorAll('script').length > 15,
          document.body.innerHTML.length < 20000 && document.querySelectorAll('script').length > 5
        ];
        
        return spaIndicators.some(indicator => indicator);
      });
    } catch (error) {
      console.log(`⚠️ Error detecting SPA: ${error.message}`);
      return false;
    }
  }
  
  // Get the original URL for a normalized URL
  getOriginalUrl(normalizedUrl) {
    return this.normalizedUrlMap.get(normalizedUrl) || normalizedUrl;
  }
  
  // Method to close the browser instance
  async closeBrowser() {
    // Only close the browser if it's not an external one
    if (browserInstance && !this.externalBrowser) {
      await browserInstance.close();
      browserInstance = null;
    }
  }
  
  // Static method to close the browser instance
  static async closeBrowser() {
    if (browserInstance) {
      await browserInstance.close();
      browserInstance = null;
    }
  }
}

class UrlProcessor {
  async processUrlsInChunks(urls, finder, options = {}) {
    const limit = pLimit(CONFIG.concurrentLimit);
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

export async function convertParentUrlToMarkdown(parentUrl, options = {}) {
  const finder = new UrlFinder();
  const processor = new UrlProcessor();
  
  // Initialize browser if provided in options
  if (options.browser) {
    await finder.getBrowser(options.browser);
    console.log('Using provided browser instance for parent URL conversion');
  }

  try {
    let urlObj;
    try {
      urlObj = new URL(parentUrl);
    } catch (error) {
      throw new AppError('Invalid URL format', 400);
    }
    
    const hostname = urlObj.hostname;
    console.log(`🚀 Starting conversion of ${parentUrl}`);

    // Process parent URL first
    console.log(`📄 Processing parent URL`);
    const normalizedParentUrl = normalizeUrl(parentUrl);
    finder.childUrls.add(normalizedParentUrl);
    finder.normalizedUrlMap.set(normalizedParentUrl, parentUrl);
    
    const parentPageResult = await processor.processUrlsInChunks([normalizedParentUrl], finder);

    // Process child URLs in chunks
    let processedPages = [...parentPageResult];
    const urlChunks = await finder.findChildUrlsInChunks(parentUrl);
    
    for (const urlChunk of urlChunks) {
      console.log(`🔄 Processing chunk of ${urlChunk.length} URLs`);
      const chunkResults = await processor.processUrlsInChunks(urlChunk, finder);
      processedPages.push(...chunkResults);
    }

    // Generate index content and metadata
    const { content: indexContent, metadata } = processor.generateIndex(parentUrl, processedPages, hostname);

    // Create files array with actual content
    const files = [
      {
        name: `index.md`,
        content: indexContent,
        type: 'text'
      }
    ];
    
    // Add individual page files with frontmatter
    const uniquePages = new Map(); // Use Map to ensure unique pages by normalized URL
    
    processedPages.filter(p => p.success).forEach(page => {
      // Add frontmatter to page content
      const pageWithFrontmatter = processor.addFrontmatterToPage(page);
      
      // Use normalized URL as key to avoid duplicates
      if (!uniquePages.has(page.normalizedUrl)) {
        uniquePages.set(page.normalizedUrl, {
          name: `pages/${page.name}`,
          content: pageWithFrontmatter.content,
          type: 'text'
        });
      }
    });
    
    // Add unique pages to files array
    files.push(...uniquePages.values());

    return {
      url: parentUrl,
      type: 'parenturl',
      name: hostname,
      content: indexContent,
      metadata,
      files,
      success: true,
      stats: {
        totalPages: processedPages.length,
        successfulPages: processedPages.filter(p => p.success).length,
        failedPages: processedPages.filter(p => !p.success).length,
        totalImages: processedPages.reduce((sum, p) => sum + (p.images?.length || 0), 0)
      }
    };

  } catch (error) {
    console.error('Parent URL conversion failed:', error);
    throw new AppError(
      error instanceof AppError ? error.message : `Failed to convert parent URL: ${error.message}`,
      error instanceof AppError ? error.statusCode : 500
    );
  } finally {
    // Close the browser instance when done
    try {
      // Use instance method to respect external browser
      await finder.closeBrowser();
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }
}

const CONFIG = {
  concurrentLimit: 30,
  validProtocols: ['http:', 'https:']
};
