/**
 * Parent URL Converter Module
 * 
 * This module provides functionality for converting entire websites to Markdown.
 * It handles crawling multiple pages and converting them to Markdown.
 * 
 * Related files:
 * - ./urlConverter.js: Single URL converter
 * - ./utils/config.js: Configuration settings
 * - ./utils/spaHandler.js: SPA detection and handling
 * - ./utils/contentExtractor.js: Content extraction logic
 * - ./utils/htmlToMarkdown.js: HTML to Markdown conversion
 */

import got from 'got';
import pLimit from 'p-limit';
import * as cheerio from 'cheerio';
import { convertUrlToMarkdown } from './urlConverter.js';
import { AppError } from '../../../utils/errorHandler.js';
import { DEFAULT_PARENT_URL_CONVERTER_OPTIONS } from './utils/config.js';

/**
 * Configuration for URL conversion
 */
const CONFIG = {
  concurrentLimit: 50,
  validProtocols: ['http:', 'https:'],
  excludePatterns: [
    // Assets to exclude
    /\.(css|js|woff|woff2|ttf|eot|svg|ico|gif|png|jpg|jpeg|webp)$/i,
    /\.(mp3|mp4|wav|avi|mov|wmv|flv|ogg|webm|m4a|m4v)$/i, // Media files
    
    // Documents and archives
    /\.(pdf|zip|doc|docx|xls|xlsx|ppt|pptx|rar|7z|tar|gz|bz2)$/i,
    
    // Tracking and analytics
    /\?(utm_|source=|campaign=|ref=|fbclid=|gclid=|dclid=|cid=|yclid=)/i,
    /\/(analytics|tracking|pixel|beacon|ad|stats|counter)\//i,
    /\.(analytics|tracking|stats)\./i,
    /\b(ga|gtm|pixel|fb|adsense|doubleclick)\b/i,
    
    // System and utility
    /#.*/,  // Anchors
    /^(mailto:|tel:|javascript:|data:|file:|blob:)/i,  // Protocols
    /\/(api|feed|rss|atom|json|xml|auth|login|signup|sitemap|robots\.txt)/i,  // System paths
    /\/(cart|checkout|account|profile|settings|dashboard|admin|wp-admin)/i,  // User/admin pages
    /\/(search|tags?|categories|archive|author|date|page\/\d+)/i,  // Navigation and pagination
    /\/(wp-admin|wp-content|wp-includes|wp-json|wp-login)/i,  // WordPress
    /\/(cdn-cgi|__webpack|_next|static|assets|dist|build|node_modules)\//i,  // Infrastructure
    
    // Dynamic and temporary
    /\?.*(?:session|token|nonce|timestamp|cache|nocache|random|_=\d+)=/i,
    /\/\d{4}\/\d{2}\/\d{2}\//,  // Date-based URLs
    
    // Social media and sharing
    /\/(?:share|tweet|pin|like|follow|subscribe|comment)/i,
    
    // E-commerce specific
    /\/(?:add-to-cart|wishlist|favorites|compare|product-comparison)/i,
    
    // Specific file types that might be linked but aren't content
    /\.(exe|dmg|pkg|deb|rpm|apk|ipa|jar|war|ear|class|dll|so|lib)$/i,
    
    // Internationalization and localization
    /\/(?:translate|language|locale|region|country|timezone)/i,
    
    // Print and view modes
    /\/(?:print|print-view|printer-friendly|mobile-view|amp)/i,
    
    // Authentication and security
    /\/(?:verify|confirm|activate|reset-password|forgot-password|unsubscribe)/i
  ],
  http: DEFAULT_PARENT_URL_CONVERTER_OPTIONS.http
};

/**
 * Simple URL finder class to get child pages
 */
class UrlFinder {
  constructor() {
    this.childUrls = new Set();
  }

  async findChildUrlsInChunks(parentUrl, chunkSize = 50) {
    try {
      console.log(`🔍 Finding child pages for: ${parentUrl}`);
      
      // Create a clean options object for got
      const gotOptions = {
        retry: {
          limit: 5,
          statusCodes: [408, 413, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524],
          methods: ['GET'],
          calculateDelay: ({retryCount}) => retryCount * 1500
        },
        timeout: {
          request: 45000,
          response: 45000
        },
        headers: {
          ...CONFIG.http.headers,
          'Cache-Control': 'no-cache, max-age=0',
          'Pragma': 'no-cache'
        },
        throwHttpErrors: false,
        followRedirect: true,
        decompress: true,
        responseType: 'text'
      };
      
      // Enhanced SPA detection and handling
      const isSPA = await this.detectSPA(parentUrl, gotOptions);
      
      // Fetch the page with appropriate options
      let response;
      let bestResponse = null;
      let bestContentScore = 0;
      
      // Always try multiple wait times to get the best content
      const waitTimes = isSPA ? [1000, 3000, 5000, 8000] : [0, 2000, 4000];
      
      for (const waitTime of waitTimes) {
        try {
          console.log(`⏱️ Trying with ${waitTime}ms delay...`);
          
          // Create options with delay
          const fetchOptions = { 
            ...gotOptions,
            headers: {
              ...gotOptions.headers,
              // Add a random query parameter to avoid caching
              'Cookie': `nocache=${Date.now()}`
            },
            timeout: {
              request: waitTime + 15000,
              response: waitTime + 15000
            },
            // Add a random query parameter to avoid caching
            searchParams: {
              '_': Date.now()
            }
          };
          
          // Add a delay if needed
          if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
          const tempResponse = await got(parentUrl, fetchOptions);
          
          // Score the content quality
          const contentScore = this.scoreUrlDiscoveryContent(tempResponse.body);
          console.log(`📊 Content score for ${waitTime}ms delay: ${contentScore}`);
          
          // Keep the response with the highest content score
          if (!bestResponse || contentScore > bestContentScore) {
            bestResponse = tempResponse;
            bestContentScore = contentScore;
          }
        } catch (e) {
          console.log(`⚠️ Error with ${waitTime}ms delay: ${e.message}`);
        }
      }
      
      response = bestResponse || await got(parentUrl, gotOptions);
      
      if (!response || !response.body) {
        throw new AppError(`Failed to load parent URL: No valid response`, 400);
      }

      if (response.statusCode >= 400) {
        throw new AppError(`Failed to load parent URL: ${response.statusCode}`, 400);
      }

      const $ = cheerio.load(response.body);
      const parentUrlObj = new URL(parentUrl);
      const chunks = [];
      let currentChunk = [];
      
      // Track URL priorities (higher = more important)
      const urlPriorities = new Map();
      
      // Track URL metadata for better prioritization
      const urlMetadata = new Map();
      
      // First pass: collect all URLs and their metadata
      console.log(`🔍 First pass: collecting all URLs and metadata...`);
      
      // Find all <a> tags with href
      $('a[href]').each((_, element) => {
        try {
          let href = $(element).attr('href');
          
          // Skip empty hrefs
          if (!href || href === '#' || href === '/') {
            return;
          }
          
          // Clean and normalize URL
          href = href.trim()
            .replace(/[\n\r\t]/g, '')
            .split('#')[0]; // Remove hash
          
          // Skip invalid protocols
          if (href.match(/^(mailto:|tel:|javascript:|data:|file:|blob:)/i)) {
            return;
          }

          // Convert to absolute URL
          const absoluteUrl = new URL(href, parentUrl).href;
          const urlObj = new URL(absoluteUrl);
          
          // Only process URLs from same domain
          if (urlObj.hostname !== parentUrlObj.hostname) {
            return;
          }
          
          // Skip excluded patterns
          if (CONFIG.excludePatterns.some(pattern => pattern.test(absoluteUrl))) {
            return;
          }
          
          // Remove query parameters for deduplication
          const normalizedUrl = absoluteUrl.split('?')[0];
          
          // Skip if already processed
          if (this.childUrls.has(normalizedUrl)) {
            return;
          }
          
          // Add to our set of discovered URLs
          this.childUrls.add(normalizedUrl);
          
          // Collect metadata about this URL
          const $element = $(element);
          const linkText = $element.text().trim();
          const isInNavigation = $element.closest('nav, .nav, .menu, .navigation, header, .header').length > 0;
          const isInMain = $element.closest('main, article, .content, #content, .post, .entry').length > 0;
          const isInSidebar = $element.closest('aside, .sidebar, .widget, .supplementary').length > 0;
          const isInFooter = $element.closest('footer, .footer').length > 0;
          const hasImage = $element.find('img').length > 0;
          const hasIcon = $element.find('i, svg, .icon').length > 0;
          const pathDepth = urlObj.pathname.split('/').filter(Boolean).length;
          const queryParams = urlObj.search ? urlObj.search.split('&').length : 0;
          const isPagination = /\/page\/\d+|[?&]page=\d+|[?&]p=\d+|[?&]offset=|[?&]limit=|[?&]start=/.test(absoluteUrl);
          const isArchive = /\/archive|\/category|\/tag|\/author|\/date|\/\d{4}\/\d{2}/.test(urlObj.pathname);
          
          // Store metadata
          urlMetadata.set(normalizedUrl, {
            url: normalizedUrl,
            linkText,
            isInNavigation,
            isInMain,
            isInSidebar,
            isInFooter,
            hasImage,
            hasIcon,
            pathDepth,
            queryParams,
            isPagination,
            isArchive
          });
        } catch (error) {
          console.log(`⚠️ Skipping invalid URL: ${error.message}`);
        }
      });
      
      // Second pass: calculate priorities and organize into chunks
      console.log(`🔍 Second pass: calculating priorities for ${urlMetadata.size} URLs...`);
      
      // Process all collected URLs
      for (const [url, metadata] of urlMetadata.entries()) {
        try {
          // Calculate URL priority based on various factors
          let priority = 0;
          
          // Content location factors
          if (metadata.isInMain) priority += 30;
          if (metadata.isInNavigation) priority += 20;
          if (metadata.isInSidebar) priority -= 10;
          if (metadata.isInFooter) priority -= 15;
          
          // URL structure factors
          priority -= metadata.pathDepth * 5;
          priority -= metadata.queryParams * 8;
          
          // Link appearance factors
          if (metadata.linkText && metadata.linkText.length > 3) priority += 10;
          if (metadata.hasImage) priority += 5;
          if (metadata.hasIcon) priority -= 5;
          
          // Content type factors
          if (metadata.isPagination) priority -= 20;
          if (metadata.isArchive) priority -= 15;
          
          // Special case for index/home page
          const urlObj = new URL(url);
          if (urlObj.pathname === '/' || urlObj.pathname === '/index.html') {
            priority += 50;
          }
          
          // Special case for important content pages
          if (/\/about|\/contact|\/faq|\/help|\/support|\/guide|\/tutorial|\/docs|\/documentation/.test(urlObj.pathname)) {
            priority += 40;
          }
          
          // Store the URL with its priority
          urlPriorities.set(url, priority);
          
          // Add to current chunk
          currentChunk.push(url);
          
          // When chunk is full, add it to chunks and start a new one
          if (currentChunk.length >= chunkSize) {
            // Sort URLs by priority before creating chunk
            currentChunk.sort((a, b) => (urlPriorities.get(b) || 0) - (urlPriorities.get(a) || 0));
            
            console.log(`📦 Creating chunk of ${currentChunk.length} URLs`);
            chunks.push([...currentChunk]);
            currentChunk = [];
            
            // Force garbage collection if available
            if (global.gc) {
              console.log('🧹 Running garbage collection after chunk');
              global.gc();
            }
          }
        } catch (error) {
          console.log(`⚠️ Error processing URL ${url}: ${error.message}`);
        }
      }

      // Add any remaining URLs as the final chunk
      if (currentChunk.length > 0) {
        // Sort URLs by priority
        currentChunk.sort((a, b) => (urlPriorities.get(b) || 0) - (urlPriorities.get(a) || 0));
        
        console.log(`📦 Creating final chunk of ${currentChunk.length} URLs`);
        chunks.push([...currentChunk]);
      }

      // Log the top 10 URLs by priority for debugging
      const topUrls = Array.from(urlPriorities.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      console.log(`🔝 Top 10 URLs by priority:`);
      topUrls.forEach(([url, priority]) => {
        console.log(`   ${priority}: ${url}`);
      });

      console.log(`✅ Found total of ${this.childUrls.size} child pages in ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      throw new AppError(`Failed to find child pages: ${error.message}`, 500);
    }
  }
  
  /**
   * Score HTML content for URL discovery quality
   * @param {string} html - The HTML content to score
   * @returns {number} - A quality score (higher is better)
   */
  scoreUrlDiscoveryContent(html) {
    if (!html) return 0;
    
    try {
      const $ = cheerio.load(html);
      
      // Count links
      const linkCount = $('a[href]').length;
      
      // Count links with text
      const linksWithText = $('a[href]').filter(function() {
        return $(this).text().trim().length > 0;
      }).length;
      
      // Count links in navigation
      const navLinks = $('nav a[href], header a[href], .navigation a[href], .menu a[href]').length;
      
      // Count links in main content
      const contentLinks = $('main a[href], article a[href], .content a[href], #content a[href]').length;
      
      // Count links with images
      const linksWithImages = $('a[href] img').length;
      
      // Calculate final score
      const score = linkCount * 2 + 
                   linksWithText * 3 + 
                   navLinks * 5 + 
                   contentLinks * 10 + 
                   linksWithImages * 3;
      
      return score;
    } catch (error) {
      console.error('Error scoring HTML content for URL discovery:', error);
      return 0;
    }
  }
  
  /**
   * Detects if a URL is likely a Single Page Application
   * @param {string} url - The URL to check
   * @param {Object} options - Request options
   * @returns {Promise<boolean>} - True if the URL is likely an SPA
   */
  async detectSPA(url, options) {
    try {
      // Do a quick HEAD request first
      const headResponse = await got.head(url, {
        ...options,
        timeout: {
          request: 5000,
          response: 5000
        }
      });
      
      // Check content type - we only care about HTML
      const contentType = headResponse.headers['content-type'] || '';
      if (!contentType.includes('text/html')) {
        return false;
      }
      
      // Do a GET request to check the content
      const response = await got(url, {
        ...options,
        timeout: {
          request: 10000,
          response: 10000
        }
      });
      
      // Check for SPA indicators in the HTML
      const spaIndicators = [
        // Framework root elements
        /<div[^>]*(?:id=['"]app['"]|id=['"]root['"])/i,
        /<div[^>]*(?:data-reactroot|data-react-app)/i,
        /<div[^>]*(?:ng-app|ng-controller|ng-view)/i,
        /<div[^>]*(?:v-app|data-v-|vue-app)/i,
        /<div[^>]*(?:data-svelte|svelte-app)/i,
        
        // Framework scripts
        /<script[^>]*(?:react|vue|angular|svelte|next|nuxt|gatsby)/i,
        
        // Common SPA patterns
        /<div[^>]*(?:router-view|ui-view|page-view)/i,
        /<div[^>]*(?:data-router|data-page|data-view)/i,
        
        // Empty content containers that will be filled by JS
        /<div[^>]*(?:id=['"]content['"]|class=['"]content['"])[^>]*>\s*<\/div>/i,
        /<div[^>]*(?:id=['"]main['"]|class=['"]main['"])[^>]*>\s*<\/div>/i,
        
        // Loading indicators
        /<div[^>]*(?:loading|spinner|skeleton)/i
      ];
      
      // Check if any SPA indicators are present
      const isSPA = spaIndicators.some(pattern => pattern.test(response.body));
      
      // Also check if the page has minimal content but lots of scripts
      const hasMinimalContent = response.body.length < 20000 && 
                               (response.body.match(/<script/g) || []).length > 5;
      
      return isSPA || hasMinimalContent;
    } catch (error) {
      console.log(`⚠️ Error detecting SPA: ${error.message}`);
      return false;
    }
  }
}

/**
 * URL Processor class to handle conversion of discovered URLs
 */
class UrlProcessor {
  async processUrlsInChunks(urls, options = {}) {
    const limit = pLimit(CONFIG.concurrentLimit);
    const results = [];
    let totalMemoryStart = process.memoryUsage().heapUsed;

    console.log(`🔄 Starting conversion with memory usage: ${Math.round(totalMemoryStart / 1024 / 1024)}MB`);

    for (const url of urls) {
      try {
        // Extract handleDynamicContent from options to avoid passing it directly to got
        const { handleDynamicContent, ...filteredOptions } = options;
        
        // Create clean options object for URL conversion
        const conversionOptions = {
          ...filteredOptions,
          includeImages: true,
          includeMeta: true,
          handleDynamicContent: handleDynamicContent !== false, // Preserve this option for SPA handling
          got: {
            retry: CONFIG.http.retry,
            timeout: CONFIG.http.timeout,
            headers: CONFIG.http.headers,
            decompress: CONFIG.http.decompress,
            followRedirect: true,
            throwHttpErrors: false,
            responseType: 'text'
          },
          spa: CONFIG.http.spa
        };

        const result = await limit(async () => {
          const convertResult = await convertUrlToMarkdown(url, conversionOptions);
          const urlPath = new URL(url).pathname || '/';
          const name = this.sanitizeFilename(urlPath);
          console.log(`✅ Converted: ${url} -> ${name}`);
          
          return {
            success: true,
            name: `${name}.md`,
            content: convertResult.content,
            images: convertResult.images || [],
            url,
            metadata: convertResult.metadata
          };
        });

        results.push(result);

        // Check memory usage and run GC if needed
        const currentMemory = process.memoryUsage().heapUsed;
        const memoryUsageMB = Math.round(currentMemory / 1024 / 1024);
        console.log(`📊 Current memory usage: ${memoryUsageMB}MB`);

        if (global.gc && memoryUsageMB > 512) { // Trigger GC if memory exceeds 512MB
          console.log('🧹 Running garbage collection...');
          global.gc();
          const afterGC = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
          console.log(`📊 Memory after GC: ${afterGC}MB`);
        }

      } catch (error) {
        console.log(`❌ Failed to convert: ${url}`);
        results.push({ success: false, url, error: error.message });
      }
    }

    const totalMemoryEnd = process.memoryUsage().heapUsed;
    const memoryDiffMB = Math.round((totalMemoryEnd - totalMemoryStart) / 1024 / 1024);
    console.log(`📊 Total memory change: ${memoryDiffMB}MB`);

    return results;
  }

  sanitizeFilename(input) {
    if (!input) return 'index';

    // Extract meaningful parts from the path
    const parts = input.split('/').filter(Boolean);
    const lastPart = parts.pop() || 'index';
    
    // Clean up the filename
    const sanitized = lastPart
      .toLowerCase()
      // Remove file extensions
      .replace(/\.[^.]+$/, '')
      // Remove query parameters
      .split('?')[0]
      // Remove special characters
      .replace(/[^a-z0-9]+/g, '-')
      // Clean up dashes
      .replace(/^-+|-+$/g, '')
      // Limit length but try to keep words intact
      .split('-')
      .reduce((acc, part) => {
        if ((acc + (acc ? '-' : '') + part).length <= 100) {
          return acc + (acc ? '-' : '') + part;
        }
        return acc;
      }, '');

    return sanitized || 'index';
  }

  /**
   * Collects unique image references from pages
   */
  collectImageReferences(pages) {
    const seenUrls = new Set();
    const images = [];

    pages.filter(p => p.success).forEach(page => {
      if (page.images) {
        page.images.forEach(img => {
          if (img?.url && !seenUrls.has(img.url)) {
            seenUrls.add(img.url);
            images.push({
              ...img,
              referenceUrl: page.url
            });
          }
        });
      }
    });

    return images;
  }

  generateIndex(parentUrl, pages, imageData) {
    const successfulPages = pages.filter(p => p.success);
    const failedPages = pages.filter(p => !p.success);
    const hostname = new URL(parentUrl).hostname;
    const timestamp = new Date().toISOString();

    // Group pages by their primary sections
    const sections = new Map();
    successfulPages.forEach(page => {
      try {
        const url = new URL(page.url);
        const pathParts = url.pathname.split('/').filter(Boolean);
        const section = pathParts[0] || 'main';
        if (!sections.has(section)) {
          sections.set(section, []);
        }
        sections.get(section).push(page);
      } catch (error) {
        console.error('Error processing page section:', error);
      }
    });

    // Generate section content
    const sectionContent = Array.from(sections.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([section, pages]) => [
        `### ${section.charAt(0).toUpperCase() + section.slice(1)}`,
        '',
        ...pages.map(page => {
          const name = page.name.replace(/\.md$/, '');
          return `- [[pages/${name}|${name}]] - [Original](${page.url})`;
        }),
        ''
      ].join('\n'));

    // Collect all image references
    const allImages = new Set();
    pages.filter(p => p.success).forEach(page => {
      if (page.images) {
        page.images.forEach(img => {
          if (img.url) allImages.add(img);
        });
      }
    });

    const imageList = Array.from(allImages)
      .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''))
      .map(img => `- [${img.alt || 'Image'}](${img.url}) (from ${img.referenceUrl})`);

    return [
      `---`,
      `title: "${hostname} Archive"`,
      `description: "Website archive of ${hostname}"`,
      `date: "${timestamp}"`,
      `source: "${parentUrl}"`,
      `archived_at: "${timestamp}"`,
      `tags:`,
      `  - website-archive`,
      `  - ${hostname.replace(/\./g, '-')}`,
      `---`,
      '',
      `# ${hostname} Website Archive`,
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
      ...sectionContent,
      '',
      failedPages.length ? [
        '## Failed Conversions',
        '',
        ...failedPages.map(page => `- ${page.url}: ${page.error}`),
        ''
      ].join('\n') : '',
      '## Referenced Images',
      '',
      'The following images are referenced in the archive:',
      '',
      ...imageList.slice(0, 30), // Limit to first 30 images to keep the list manageable
      '',
      '## Notes',
      '',
      '- All pages are stored in the `pages/` folder',
      '- Internal links are preserved as wiki-links',
      '- Original URLs are preserved in page metadata',
      '- Images are linked to their original source URLs',
      '- Generated with Obsidian Note Converter'
    ].join('\n');
  }
}

/**
 * Converts a parent URL and its child pages to Markdown
 * @param {string} parentUrl - The URL normalized by the frontend
 */
export async function convertParentUrlToMarkdown(parentUrl) {
  const finder = new UrlFinder();
  const processor = new UrlProcessor();

  try {
    // Basic URL validation
    let urlObj;
    try {
      urlObj = new URL(parentUrl);
    } catch (error) {
      throw new AppError('Invalid URL format', 400);
    }
    
    const hostname = urlObj.hostname;
    console.log(`🚀 Starting conversion of ${parentUrl}`);

    // Initialize the result structure
    const result = {
      url: parentUrl,
      type: 'parenturl',
      name: hostname,
      files: [],
      stats: {
        totalPages: 0,
        successfulPages: 0,
        failedPages: 0,
        totalImages: 0
      }
    };

    // Process parent URL first
    console.log(`📄 Processing parent URL`);
    const parentPageResult = await processor.processUrlsInChunks([parentUrl]);
    if (parentPageResult[0].success) {
      result.files.push({
        name: `web/${hostname}/pages/${parentPageResult[0].name}`,
        content: parentPageResult[0].content,
        type: 'text'
      });
    }

    // Process child URLs in chunks
    let processedPages = [parentPageResult[0]];
    const urlChunks = await finder.findChildUrlsInChunks(parentUrl);
    
    for (const urlChunk of urlChunks) {
      console.log(`🔄 Processing chunk of ${urlChunk.length} URLs`);
      
      const chunkResults = await processor.processUrlsInChunks(urlChunk);
      
      // Update stats
      result.stats.totalPages += chunkResults.length;
      result.stats.successfulPages += chunkResults.filter(p => p.success).length;
      result.stats.failedPages += chunkResults.filter(p => !p.success).length;
      
      // Add successful conversions to files
      const chunkFiles = chunkResults
        .filter(p => p.success)
        .map(({ name, content }) => ({
          name: `web/${hostname}/pages/${name}`,
          content,
          type: 'text'
        }));
      
      result.files.push(...chunkFiles);
      processedPages.push(...chunkResults);
      
      // Force garbage collection after each chunk if available
      if (global.gc) {
        console.log('🧹 Running garbage collection after chunk processing');
        global.gc();
      }
    }

    // Collect image references and generate index
    console.log(`📊 Collecting image references and generating index`);
    const imageRefs = processor.collectImageReferences(processedPages);
    const index = processor.generateIndex(parentUrl, processedPages, { images: imageRefs });

    // Create files array with markdown content
    const files = [
      {
        name: `web/${hostname}/index.md`,
        content: index,
        type: 'text'
      },
      ...processedPages
        .filter(p => p.success)
        .map(({ name, content }) => ({
          name: `web/${hostname}/pages/${name}`,
          content,
          type: 'text'
        }))
    ];

    return {
      url: parentUrl,
      type: 'parenturl',
      content: index,
      name: hostname,
      files,
      success: true,
      stats: {
        totalPages: processedPages.length,
        successfulPages: processedPages.filter(p => p.success).length,
        failedPages: processedPages.filter(p => !p.success).length,
        totalImages: imageRefs.length
      }
    };
  } catch (error) {
    console.error('URL conversion failed:', error);
    throw new AppError(
      error instanceof AppError ? error.message : `Failed to convert URL: ${error.message}`,
      error instanceof AppError ? error.statusCode : 500
    );
  }
}
