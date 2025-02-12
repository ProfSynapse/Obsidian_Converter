// services/converter/web/parenturlConverter.js

import got from 'got';
import pLimit from 'p-limit';
import * as cheerio from 'cheerio';
import { convertUrlToMarkdown } from './urlConverter.js';
import { AppError } from '../../../utils/errorHandler.js';

/**
 * Configuration for URL processing and crawling
 */
const CONFIG = {
  crawler: {
    maxPages: 100,
    maxDepth: 1000,
    concurrentLimit: 5,
    timeout: 30000,
    validProtocols: ['http:', 'https:'],
    excludePatterns: [
      /\.(pdf|zip|doc|docx|xls|xlsx|ppt|pptx)$/i,  // Document files
      /\?(utm_|source=|campaign=)/i,                // Tracking parameters
      /#.*/,                                        // Hash fragments
      /\/api\//,                                    // API endpoints
      /\/feed\//,                                   // RSS/Atom feeds
      /\/rss\//                                     // RSS feeds
    ],
    retry: {
      limit: 3,
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      methods: ['GET']
    }
  },
  http: {
    defaultTimeout: 30000,
    headers: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.7',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    decompress: true,
    responseType: 'text',
    resolveBodyOnly: false,
    dynamicContentWait: 2000, // Wait time in ms for dynamic content
    preflight: {
      timeout: 5000,      // Quick check timeout
      retries: 2          // Limited retries for preflight
    },
    timeouts: {
      lookup: 3000,       // DNS lookup timeout
      connect: 5000,      // TCP connection timeout
      request: 30000,     // Full request timeout
      response: 30000     // Response timeout
    },
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 50,       // Maximum concurrent sockets
    cleanup: {
      interval: 60000,    // Cleanup interval
      maxAge: 300000     // Max age for cached connections
    },
    spa: {
      selectors: [
        '[data-router-view]',   // Common SPA view containers
        '[data-view]',
        '[ng-view]',
        '[ui-view]',
        '[v-cloak]',           // Vue.js
        '[data-reactroot]',    // React
        '[ng-app]',            // Angular
        '.nuxt-content',       // Nuxt.js
        '.gatsby-content'      // Gatsby
      ],
      navigationTimeout: 5000
    }
  }
};

/**
 * Class to manage URL crawling and processing
 */
class WebsiteCrawler {
  constructor() {
    this.discoveredUrls = new Set();
    this.maxDepth = CONFIG.crawler.maxDepth;
  }

  async crawl(startUrl) {
    try {
      const queue = [{ url: startUrl, depth: 0 }];
      const visitedUrls = new Set();
      const limit = pLimit(CONFIG.crawler.concurrentLimit);
      let activeTasks = [];

      console.log(`Starting crawl of: ${startUrl}`);

      while (
        (queue.length > 0 || activeTasks.length > 0) &&
        this.discoveredUrls.size < CONFIG.crawler.maxPages
      ) {
        while (queue.length > 0 && activeTasks.length < CONFIG.crawler.concurrentLimit) {
          const { url, depth } = queue.shift();
          if (visitedUrls.has(url) || depth > this.maxDepth) continue;
          visitedUrls.add(url);

          const task = limit(() => this.processUrl(url, startUrl, depth, queue, visitedUrls));
          activeTasks.push(task);
        }

        if (activeTasks.length > 0) {
          await Promise.race(activeTasks).catch(error => {
            console.warn('Task error:', error.message);
          });
          activeTasks = activeTasks.filter(task => task.isPending?.());
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (activeTasks.length > 0) {
        await Promise.allSettled(activeTasks);
      }

      console.log(`\nCrawl completed - Found ${this.discoveredUrls.size} pages\n`);
      return this.discoveredUrls;
    } catch (error) {
      console.error('Crawl error:', error);
      throw error;
    }
  }

  async processUrl(url, parentUrl, depth, queue, visitedUrls) {
    try {
      console.log(`🔄 Processing URL: ${url}`);
      
      // Quick HEAD request to check content type
      try {
        const preflightOptions = {
          retry: {
            limit: CONFIG.http.preflight.retries,
            statusCodes: [408, 429, 500, 502, 503, 504],
            methods: ['HEAD'],
            calculateDelay: ({retryCount}) => retryCount * 500
          },
          timeout: {
            lookup: CONFIG.http.timeouts.lookup,
            connect: CONFIG.http.timeouts.connect,
            request: CONFIG.http.preflight.timeout,
            response: CONFIG.http.preflight.timeout
          },
          headers: CONFIG.http.headers,
          throwHttpErrors: false,
          followRedirect: true,
          maxRedirects: 5,
          keepAlive: CONFIG.http.keepAlive,
          keepAliveMsecs: CONFIG.http.keepAliveMsecs
        };

        const headResponse = await got.head(url, preflightOptions);

        // Skip if it's not HTML and not an SPA
        const contentType = headResponse.headers['content-type'] || '';
        if (!contentType.includes('html') && 
            !contentType.includes('text/plain') && // Some SPAs return text/plain
            contentType !== '') {
          console.log(`⚠️ Skipping non-HTML content: ${url} (${contentType})`);
          return;
        }
      } catch (headError) {
        // If HEAD fails, we'll still try GET (some servers don't support HEAD)
        console.log(`⚠️ HEAD request failed for ${url}, falling back to GET`);
      }

      // Proceed with GET request with full timeout and connection settings
      const fullRequestOptions = {
        retry: {
          limit: CONFIG.crawler.retry.limit,
          statusCodes: CONFIG.crawler.retry.statusCodes,
          methods: CONFIG.crawler.retry.methods,
          calculateDelay: ({retryCount}) => retryCount * 1000
        },
        timeout: {
          lookup: CONFIG.http.timeouts.lookup,
          connect: CONFIG.http.timeouts.connect,
          request: CONFIG.http.timeouts.request,
          response: CONFIG.http.timeouts.response
        },
        headers: CONFIG.http.headers,
        throwHttpErrors: false,
        followRedirect: true,
        maxRedirects: 10,
        decompress: CONFIG.http.decompress,
        keepAlive: CONFIG.http.keepAlive,
        keepAliveMsecs: CONFIG.http.keepAliveMsecs,
        maxSockets: CONFIG.http.maxSockets
      };

      console.log('Sending GET request with options:', {
        url,
        options: fullRequestOptions
      });

      const response = await got(url, fullRequestOptions);

      console.log('Got response:', {
        url,
        statusCode: response.statusCode,
        finalUrl: response.url,
        contentType: response.headers['content-type'],
        bodyLength: response.body?.length
      });

      // Get the final URL after redirects
      const finalUrl = response.url;

      if (!response.ok) {
        console.log(`❌ Failed to load: ${finalUrl} (${response.statusCode})`);
        return;
      }

      // Check if the final URL is valid for our domain
      if (!await this.isValidUrl(finalUrl, parentUrl)) {
        console.log(`⚠️ Skipping external URL after redirect: ${finalUrl}`);
        return;
      }

      // Some servers might not provide content-type header, attempt to parse HTML anyway
      const contentType = response.headers['content-type'] || '';
      const isHtml = contentType.includes('text/html') || 
                    contentType === '' || // Empty content type - try anyway
                    response.body.trim().startsWith('<!DOCTYPE html>') ||
                    response.body.trim().startsWith('<html');

      if (isHtml) {
        // Wait for dynamic content if SPA indicators are found
        let html = response.body;
        const $ = cheerio.load(html);
        
        const hasSpaIndicators = CONFIG.http.spa.selectors.some(selector => 
          $(selector).length > 0
        );

        if (hasSpaIndicators || html.includes('app.js') || html.includes('bundle.js')) {
          console.log('🔄 SPA detected, waiting for dynamic content...');
          
          // Add small delay to allow dynamic content to load
          await new Promise(resolve => setTimeout(resolve, CONFIG.http.dynamicContentWait));

          // Recheck for more content after delay
          const afterLinks = await this.extractLinks(html, finalUrl);
          if (afterLinks.length > 0) {
            console.log(`Found ${afterLinks.length} links after dynamic content wait`);
          }
        }

        this.discoveredUrls.add(finalUrl);
        const links = await this.extractLinks(html, finalUrl);
        console.log(`✓ Processed: ${finalUrl} (${links.length} links)`);

        for (const link of links) {
          if (!visitedUrls.has(link)) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }

      // Log if we're skipping content
      if (!isHtml) {
        console.log(`⚠️ Skipping non-HTML content: ${finalUrl} (${contentType})`);
      }
    } catch (error) {
      console.log(`❌ Error on ${url}: ${error.message}`);
    }
  }

  async extractLinks(html, baseUrl) {
    const links = new Set();
    const $ = cheerio.load(html);
    const linkPromises = [];

    // Function to process URL
    const processUrl = (href) => {
      if (!href) return;
      try {
        // Clean the URL
        href = href.trim()
          .replace(/[\n\r\t]/g, '')
          .split('#')[0] // Remove hash
          .split('?')[0]; // Remove query params

        if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
          return;
        }

        const absoluteUrl = new URL(href, baseUrl).href;
        linkPromises.push(this.resolveRedirects(absoluteUrl));
      } catch (error) {
        console.log(`⚠️ Invalid URL found: ${href}`);
      }
    };

    // Extract all <a href> links
    $('a[href]').each((_, element) => {
      processUrl($(element).attr('href'));
    });

    // Extract canonical links
    $('link[rel="canonical"]').each((_, element) => {
      processUrl($(element).attr('href'));
    });

    // Extract meta refresh redirects
    $('meta[http-equiv="refresh"]').each((_, element) => {
      const content = $(element).attr('content');
      if (content) {
        const match = content.match(/URL=['"]?([^'"]+)['"]?/i);
        if (match) {
          processUrl(match[1]);
        }
      }
    });

    // Extract alternate links
    $('link[rel="alternate"]').each((_, element) => {
      processUrl($(element).attr('href'));
    });

    // Extract pagination links
    $('link[rel="next"], link[rel="prev"]').each((_, element) => {
      processUrl($(element).attr('href'));
    });

    // Extract Open Graph URLs
    $('meta[property="og:url"]').each((_, element) => {
      processUrl($(element).attr('content'));
    });

    // Extract script-based redirects
    const scriptContent = $('script').text();
    const urlMatches = scriptContent.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/g);
    if (urlMatches) {
      urlMatches.forEach(match => {
        const url = match.split(/['"]/)[1];
        processUrl(url);
      });
    }

    // Wait for all redirects to be resolved and filter duplicates
    const resolvedLinks = await Promise.all(linkPromises);
    resolvedLinks.forEach(link => {
      if (link) links.add(link);
    });

    console.log(`Found ${links.size} unique links on ${baseUrl}`);
    return Array.from(links);
  }

  async resolveRedirects(url) {
    try {
      const resolveOptions = {
        retry: {
          limit: CONFIG.crawler.retry.limit,
          statusCodes: CONFIG.crawler.retry.statusCodes,
          methods: CONFIG.crawler.retry.methods,
          calculateDelay: ({retryCount}) => retryCount * 1000
        },
        timeout: {
          lookup: CONFIG.http.timeouts.lookup,
          connect: CONFIG.http.timeouts.connect,
          request: CONFIG.http.timeouts.request,
          response: CONFIG.http.timeouts.response
        },
        headers: CONFIG.http.headers,
        followRedirect: true,
        maxRedirects: 10,
        decompress: CONFIG.http.decompress,
        keepAlive: CONFIG.http.keepAlive,
        keepAliveMsecs: CONFIG.http.keepAliveMsecs,
        maxSockets: CONFIG.http.maxSockets
      };

      const response = await got.head(url, resolveOptions);
      
      const redirectInfo = {
        originalUrl: url,
        finalUrl: response.url,
        statusCode: response.statusCode,
        redirectChain: response.redirectUrls || []
      };
      
      console.log('Redirect resolved:', redirectInfo);
      
      return response.url;
    } catch (error) {
      console.log(`❌ Failed to resolve redirects for ${url}:`, error.message);
      return null;
    }
  }

  /**
   * Gets the root domain from a hostname
   * @private 
   */
  #getRootDomain(hostname) {
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    return parts.slice(-2).join('.');
  }

  /**
   * Checks if a URL belongs to same root domain or is a valid CDN domain
   * @private
   */
  #isSameDomainOrCDN(urlDomain, parentDomain) {
    // Clean and get root domains
    const cleanUrl = urlDomain.replace(/^www\./, '');
    const cleanParent = parentDomain.replace(/^www\./, '');

    // Get root domains
    const urlRoot = this.#getRootDomain(cleanUrl);
    const parentRoot = this.#getRootDomain(cleanParent);

    // Check if domains are exactly same
    if (cleanUrl === cleanParent) return true;

    // Check if root domains match
    if (urlRoot === parentRoot) return true;

    // Check for common CDN and hosting domains
    const cdnDomains = [
      'cloudfront.net',
      'netlify.app',
      'pages.dev',
      'hs-sites.com',
      'hubspot.com',
      'amazonaws.com',
      'cloudflare.net',
      'azurewebsites.net',
      'azureedge.net',
      'vercel.app',
      'webflow.io',
      'squarespace.com',
      'wixsite.com',
      'shopify.com',
      'myshopify.com',
      'cdn.shopify.com',
      'webflow.com',
      'ghost.io',
      'ngrok.io',
      'herokuapp.com',
      'gtm.js',
      'googletagmanager.com',
      'fastly.net',
      'akamaized.net',
      'cloudinary.com',
      'imgix.net'
    ];

    // Also check for subdomains of the parent domain
    const parentDomainParts = cleanParent.split('.');
    if (cleanUrl.endsWith(parentDomainParts.slice(-2).join('.'))) {
      return true;
    }

    // Return true if the URL is from a CDN and has the original domain as a subdomain
    return cdnDomains.some(cdn => {
      if (cleanUrl.endsWith(cdn)) {
        const subdomain = cleanUrl.replace(new RegExp(`\\.${cdn.replace('.', '\\.')}$`), '');
        return subdomain.includes(cleanParent);
      }
      return false;
    });
  }

  async isValidUrl(url, parentUrl) {
    try {
      // Get final URL after redirects
      const finalUrl = await this.resolveRedirects(url);
      if (!finalUrl) return false;

      const urlObj = new URL(finalUrl);
      const parentObj = new URL(parentUrl);

      console.log('Checking URL validity:', {
        url: finalUrl,
        parent: parentUrl,
        urlDomain: urlObj.hostname,
        parentDomain: parentObj.hostname
      });

      // Check domain validity
      if (!this.#isSameDomainOrCDN(urlObj.hostname, parentObj.hostname)) {
        console.log('❌ Domain mismatch:', {
          url: urlObj.hostname,
          parent: parentObj.hostname,
          urlRoot: this.#getRootDomain(urlObj.hostname),
          parentRoot: this.#getRootDomain(parentObj.hostname)
        });
        return false;
      }

      // Check exclusion patterns
      const excluded = CONFIG.crawler.excludePatterns.some(pattern => pattern.test(finalUrl));
      if (excluded) {
        console.log('❌ URL excluded by pattern:', finalUrl);
        return false;
      }

      return true;
    } catch (error) {
      console.log('❌ URL validation error:', error.message);
      return false;
    }
  }
}

/**
 * URL Processor class to handle conversion of discovered URLs
 */
class UrlProcessor {
  async processUrls(urls, options = {}) {
    const limit = pLimit(CONFIG.crawler.concurrentLimit);
    console.log(`\nConverting ${urls.size} pages to Markdown...\n`);

    const tasks = Array.from(urls).map(url =>
      limit(async () => {
        try {
          const result = await convertUrlToMarkdown(url, {
            ...options,
            includeImages: true,
            includeMeta: true,
            got: {
              decompress: CONFIG.http.decompress,
              followRedirect: true,
              maxRedirects: 10,
              throwHttpErrors: false,
              headers: CONFIG.http.headers,
              keepAlive: CONFIG.http.keepAlive,
              keepAliveMsecs: CONFIG.http.keepAliveMsecs,
              maxSockets: CONFIG.http.maxSockets,
              timeout: {
                lookup: CONFIG.http.timeouts.lookup,
                connect: CONFIG.http.timeouts.connect,
                request: CONFIG.http.timeouts.request,
                response: CONFIG.http.timeouts.response
              },
              retry: {
                limit: CONFIG.crawler.retry.limit,
                statusCodes: CONFIG.crawler.retry.statusCodes,
                methods: CONFIG.crawler.retry.methods,
                calculateDelay: ({retryCount}) => retryCount * 1000
              }
            },
            dynamicContentWait: CONFIG.http.dynamicContentWait,
            spa: CONFIG.http.spa
          });

          const urlPath = new URL(url).pathname || '/';
          const name = this.sanitizeFilename(urlPath);
          console.log(`✓ Converted: ${url} -> ${name}`);
          return {
            success: true,
            name: `${name}.md`,
            content: result.content,
            images: result.images || [],
            url,
            metadata: result.metadata
          };
        } catch (error) {
          console.log(`❌ Failed to convert: ${url}`);
          return { success: false, url, error: error.message };
        }
      })
    );

    return await Promise.all(tasks);
  }

  sanitizeFilename(input) {
    if (!input) return 'index';

    return input
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'index';
  }

  generateIndex(parentUrl, pages) {
    const successfulPages = pages.filter(p => p.success);
    const failedPages = pages.filter(p => !p.success);
    const hostname = new URL(parentUrl).hostname;

    return [
      `---`,
      `title: "${hostname} Archive"`,
      `description: "Website archive of ${hostname}"`,
      `date: "${new Date().toISOString()}"`,
      `tags:`,
      `  - website-archive`,
      `  - ${hostname.replace(/\./g, '-')}`,
      `---`,
      '',
      `# ${hostname} Website Archive`,
      '',
      '## Site Information',
      `- **Source URL:** ${parentUrl}`,
      `- **Archived:** ${new Date().toISOString()}`,
      `- **Total Pages:** ${pages.length}`,
      `- **Successful:** ${successfulPages.length}`,
      `- **Failed:** ${failedPages.length}`,
      '',
      '## Successfully Converted Pages',
      '',
      ...successfulPages.map(page => {
        const name = page.name.replace(/\.md$/, '');
        return `- [[pages/${name}|${name}]] - [Original](${page.url})`;
      }),
      '',
      failedPages.length ? [
        '## Failed Conversions',
        '',
        ...failedPages.map(page => `- ${page.url}: ${page.error}`),
        ''
      ].join('\n') : '',
      '## Notes',
      '',
      '- All images are stored in the `assets/` folder',
      '- Internal links are preserved as wiki-links',
      '- Original URLs are preserved in page metadata',
      '- Images use Obsidian format: ![[image.jpg]]',
      '- Generated with Obsidian Note Converter'
    ].join('\n');
  }
}

/**
 * Converts a parent URL and its children to Markdown
 */
export async function convertParentUrlToMarkdown(parentUrl) {
  const crawler = new WebsiteCrawler();
  const processor = new UrlProcessor();

  // Normalize and validate the parent URL first
  try {
    parentUrl = normalizeUrl(parentUrl);
    new URL(parentUrl); // Validate URL format
  } catch (error) {
    console.error('Invalid parent URL:', error);
    throw new AppError(`Invalid parent URL: ${error.message}`, 400);
  }

  console.log('Starting parent URL conversion:', {
    url: parentUrl,
    hostname: new URL(parentUrl).hostname,
    config: {
      maxPages: CONFIG.crawler.maxPages,
      maxDepth: CONFIG.crawler.maxDepth,
      retryLimit: CONFIG.crawler.retry.limit,
      timeout: CONFIG.crawler.timeout
    }
  });

  try {
    const startTime = Date.now();
    const urls = await crawler.crawl(parentUrl);
    console.log(`Found ${urls.size} URLs to process`);

    if (urls.size === 0) {
      throw new AppError('No valid URLs found to convert', 400);
    }

    const processedPages = await processor.processUrls(urls, {
      decompress: true,
      followRedirect: true,
      maxRedirects: 10,
      throwHttpErrors: false
    });
    const hostname = new URL(parentUrl).hostname;

    // Process and deduplicate images
    const seenImageUrls = new Set();
    const allImages = processedPages
      .filter(p => p.success)
      .flatMap(p => p.images || [])
      .filter(img => {
        if (!img?.data || !img?.name || seenImageUrls.has(img.url)) {
          return false;
        }
        seenImageUrls.add(img.url);
        return true;
      })
      .map(img => ({
        name: `web/${hostname}/assets/${img.name.split('/').pop()}`,
        data: img.data,
        type: 'binary',
        metadata: img.metadata
      }));

    const index = processor.generateIndex(parentUrl, processedPages);

    return {
      url: parentUrl,
      type: 'parenturl',
      content: index,
      name: hostname,
      files: [
        {
          name: `web/${hostname}/index.md`,
          content: index,
          type: 'text'
        },
        ...processedPages
          .filter(p => p.success)
          .map(({ name, content }) => ({
            name: `web/${hostname}/pages/${name}`,
            // Replace image references to use relative paths
            content: content.replace(/!\[\[(.*?)\]\]/g, `![[../assets/$1]]`),
            type: 'text'
          }))
      ],
      images: allImages,
      success: true
    };
  } catch (error) {
    console.error('Parent URL conversion failed:', error);
    throw new AppError(`Failed to convert parent URL: ${error.message}`, 500);
  }
}

/**
 * Validates and normalizes a URL
 */
function normalizeUrl(url) {
  try {
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url.replace(/^\/\//, '');
    }

    const urlObj = new URL(url);
    if (!CONFIG.crawler.validProtocols.includes(urlObj.protocol)) {
      throw new Error(`Invalid protocol: ${urlObj.protocol}`);
    }

    return urlObj.href;
  } catch (error) {
    throw new Error(`Invalid URL: ${error.message}`);
  }
}
