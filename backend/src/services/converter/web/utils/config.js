/**
 * URL Converter Configuration Module
 * 
 * This module provides configuration settings for the URL converter.
 * It includes constants and settings used by the other utility modules.
 * 
 * Related files:
 * - ../urlConverter.js: Main URL converter implementation
 * - ./spaHandler.js: SPA detection and handling
 * - ./contentExtractor.js: Content extraction logic
 * - ./htmlToMarkdown.js: HTML to Markdown conversion
 */

/**
 * Default HTTP request options
 */
export const DEFAULT_HTTP_OPTIONS = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  },
  timeout: 30000,
  retry: 2,
  decompress: true,
  responseType: 'text'
};

/**
 * Default content selectors in order of priority
 * These are used to find the main content of a page
 */
export const DEFAULT_CONTENT_SELECTORS = [
  // Common article/content containers
  'article',
  'main',
  '.article',
  '.post',
  '.content',
  '.main-content',
  '.entry-content',
  '.post-content',
  '.article-content',
  '.blog-post',
  '.blog-content',
  
  // Documentation specific
  '.documentation',
  '.docs',
  '.doc-content',
  '.markdown-body',
  '.readme',
  
  // Wiki specific
  '.wiki-content',
  '.wiki-body',
  '.mw-parser-output',
  
  // Forum specific
  '.forum-post',
  '.forum-content',
  '.message-body',
  '.post-message',
  
  // Generic content containers
  '#content',
  '#main',
  '.container',
  '.page-content',
  '.site-content',
  
  // Fallbacks
  'section',
  '.section',
  '#primary',
  '.primary',
  '.middle',
  '.center',
  '.wrapper',
  '.inner',
  '.body'
];

/**
 * Default selectors to exclude from content extraction
 */
export const DEFAULT_EXCLUDE_SELECTORS = [
  // Navigation
  'nav',
  'header',
  'footer',
  '.nav',
  '.navigation',
  '.menu',
  '.header',
  '.footer',
  '.breadcrumbs',
  
  // Sidebars
  'aside',
  '.sidebar',
  '.side-bar',
  '.widget',
  '.widgets',
  
  // Comments
  '.comments',
  '.comment-section',
  '#comments',
  '.disqus',
  
  // Social sharing
  '.share',
  '.social',
  '.social-share',
  '.sharing',
  
  // Ads
  '.ad',
  '.ads',
  '.advertisement',
  '.advert',
  '.banner',
  '.sponsored',
  '.promotion',
  
  // Related content
  '.related',
  '.recommended',
  '.suggestions',
  '.more-articles',
  '.more-posts',
  
  // Popups and overlays
  '.popup',
  '.modal',
  '.overlay',
  '.cookie-notice',
  '.newsletter-signup',
  '.subscription',
  
  // Author info
  '.author-bio',
  '.author-info',
  '.about-author',
  
  // Tags and categories
  '.tags',
  '.categories',
  '.taxonomy',
  
  // Search
  '.search',
  '.search-form',
  
  // Pagination
  '.pagination',
  '.pager',
  '.page-navigation',
  
  // Utility elements
  '.print',
  '.email',
  '.bookmark',
  '.save',
  '.toolbar'
];

/**
 * Wait times for SPA content loading (in milliseconds)
 */
export const WAIT_TIMES = [500, 1000, 2000, 3000, 5000];

/**
 * Supported image extensions
 */
export const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp'
];

/**
 * Default URL converter options
 */
export const DEFAULT_URL_CONVERTER_OPTIONS = {
  http: DEFAULT_HTTP_OPTIONS,
  contentSelectors: DEFAULT_CONTENT_SELECTORS,
  excludeSelectors: DEFAULT_EXCLUDE_SELECTORS,
  includeImages: true,
  includeMeta: true,
  handleDynamicContent: true,
  maxDepth: 1,
  maxPages: 10,
  followLinks: false,
  linkSelector: 'a[href]',
  sameHostOnly: true,
  includeOriginalUrl: true,
  timeout: 60000, // Overall timeout for the entire conversion process
  retryDelay: 1000,
  maxRetries: 3
};

/**
 * Default parent URL converter options
 */
export const DEFAULT_PARENT_URL_CONVERTER_OPTIONS = {
  ...DEFAULT_URL_CONVERTER_OPTIONS,
  followLinks: true,
  maxDepth: 2,
  maxPages: 20,
  linkSelector: 'a[href]:not([href^="#"]):not([href^="javascript:"]):not([href$=".pdf"]):not([href$=".zip"])',
  sameHostOnly: true,
  includeOriginalUrl: true,
  skipDuplicateContent: true,
  contentSimilarityThreshold: 0.8, // Skip pages with content similarity above this threshold
  skipUrlPatterns: [
    /\/login\//i,
    /\/signup\//i,
    /\/register\//i,
    /\/account\//i,
    /\/cart\//i,
    /\/checkout\//i,
    /\/privacy\//i,
    /\/terms\//i,
    /\/contact\//i,
    /\/about\//i,
    /\/search\//i,
    /\/tag\//i,
    /\/category\//i,
    /\/author\//i,
    /\/date\//i,
    /\/page\/\d+/i,
    /\?page=\d+/i,
    /\?p=\d+/i
  ]
};

export default {
  DEFAULT_HTTP_OPTIONS,
  DEFAULT_CONTENT_SELECTORS,
  DEFAULT_EXCLUDE_SELECTORS,
  WAIT_TIMES,
  IMAGE_EXTENSIONS,
  DEFAULT_URL_CONVERTER_OPTIONS,
  DEFAULT_PARENT_URL_CONVERTER_OPTIONS
};
