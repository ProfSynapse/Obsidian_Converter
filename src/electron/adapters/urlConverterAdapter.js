/**
 * URL Converter Adapter
 */

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const PageMarkerService = require('../services/PageMarkerService');
const BrowserService = require('../services/BrowserService');

async function loadUrlConverter() {
  try {
    const urlConverterPath = path.resolve(__dirname, '../../../backend/src/services/converter/web/urlConverter.js');
    
    if (!fs.existsSync(urlConverterPath)) {
      throw new Error(`URL converter module not found at: ${urlConverterPath}`);
    }
    
    const fileUrl = pathToFileURL(urlConverterPath).href;
    console.log('Loading URL converter from:', fileUrl);
    
    const { convertUrlToMarkdown } = await import(fileUrl);
    return { convertUrlToMarkdown };
  } catch (error) {
    console.error('Failed to load URL converter module:', error);
    throw error;
  }
}

const modulePromise = loadUrlConverter();

/**
 * Adapts the backend URL converter for use in Electron
 */
async function convertUrl(url, options = {}) {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // Define common encodings and formats
    const acceptEncodings = 'gzip, deflate, br';
    const acceptFormats = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
    const acceptLanguage = 'en-US,en;q=0.9';
    
    // Standard browser-like headers
    const defaultHeaders = {
      'accept': acceptFormats,
      'accept-encoding': acceptEncodings,
      'accept-language': acceptLanguage,
      'cache-control': 'no-cache',
      'dnt': '1',
      'pragma': 'no-cache',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };

    // Default options with enhanced timeout and retry settings
    const defaultOptions = {
      includeImages: true,
      includeMeta: true,
      handleDynamicContent: true,
      got: {
        headers: defaultHeaders,
        timeout: {
          lookup: 3000,     // DNS lookup timeout
          connect: 5000,    // TCP connection timeout
          secureConnect: 5000, // TLS handshake timeout
          socket: 30000,    // Socket inactivity timeout
          send: 30000,      // Time to send request
          response: 30000   // Time to receive response headers
        },
        retry: {
          limit: 3,
          methods: ['GET', 'HEAD'],
          statusCodes: [408, 413, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524],
          errorCodes: [
            'ETIMEDOUT',
            'ECONNRESET',
            'EADDRINUSE',
            'ECONNREFUSED',
            'EPIPE',
            'ENOTFOUND',
            'ENETUNREACH',
            'EAI_AGAIN'
          ]
        },
        hooks: {
          beforeRequest: [
            // Add random delay between requests
            async options => {
              const delay = Math.floor(Math.random() * 500) + 200; // 200-700ms
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          ]
        },
        decompress: true,
        responseType: 'text',
        followRedirect: true,
        throwHttpErrors: false,
        searchParams: new URLSearchParams({
          '_': Date.now().toString()
        })
      }
    };

    // Deep merge options
    const mergedOptions = {
      ...defaultOptions,
      ...options,
      got: {
        ...(defaultOptions.got || {}),
        ...(options.got || {}),
        headers: {
          ...(defaultOptions.got?.headers || {}),
          ...(options.got?.headers || {})
        },
        retry: {
          ...(defaultOptions.got?.retry || {}),
          ...(options.got?.retry || {})
        },
        timeout: {
          ...(defaultOptions.got?.timeout || {}),
          ...(options.got?.timeout || {})
        },
        hooks: {
          beforeRequest: [
            ...(defaultOptions.got?.hooks?.beforeRequest || []),
            ...(options.got?.hooks?.beforeRequest || [])
          ]
        }
      }
    };

    const { convertUrlToMarkdown } = await modulePromise;
    
    console.log(`🔄 Converting URL to Markdown: ${url}`);
    
    // Get the browser instance from BrowserService
    try {
      const browser = await BrowserService.getBrowser();
      
      // Add the browser instance to the options
      mergedOptions.browser = browser;
      
      console.log('Using shared browser instance for URL conversion');
    } catch (error) {
      console.warn('Failed to get shared browser instance, will create a new one:', error.message);
      // Continue without shared browser - the converter will create its own
    }
    
    const result = await convertUrlToMarkdown(url, mergedOptions);
    
    return {
      content: result.content,
      success: true,
      name: result.name,
      metadata: result.metadata,
      images: result.images,
      url: result.url,
      type: 'url'
    };

  } catch (error) {
    console.error('URL conversion failed in adapter:', error);
    return {
      success: false,
      error: error.message || 'URL conversion failed',
      url,
      type: 'url'
    };
  }
}

module.exports = {
  convertUrl
};
