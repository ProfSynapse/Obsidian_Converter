/**
 * BrowserService.js
 * 
 * Manages a single Puppeteer browser instance for the application.
 * Provides lazy initialization and access to the browser instance.
 * 
 * Related files:
 * - ../adapters/urlConverterAdapter.js: Uses this service for URL conversion
 * - ../adapters/parentUrlConverterAdapter.js: Uses this service for parent URL conversion
 * - ../../backend/src/services/converter/web/urlConverter.js: Accepts browser instance
 * - ../../backend/src/services/converter/web/parentUrlConverter.js: Accepts browser instance
 */

const path = require('path');
const { app } = require('electron');
const { pathToFileURL } = require('url');

class BrowserService {
  constructor() {
    this.browser = null;
    this.browserPromise = null;
    this.isInitializing = false;
    this.puppeteer = null;
    this.initializationError = null;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.getBrowser = this.getBrowser.bind(this);
    this.createPage = this.createPage.bind(this);
    this.close = this.close.bind(this);
  }

  /**
   * Initialize the Puppeteer browser instance
   * @returns {Promise<Browser>} The browser instance
   */
  async initialize() {
    // If already initializing, return the existing promise
    if (this.isInitializing) {
      return this.browserPromise;
    }
    
    // If already initialized, return the existing browser
    if (this.browser) {
      return this.browser;
    }
    
    // Reset initialization error
    this.initializationError = null;
    
    // Set initializing flag
    this.isInitializing = true;
    
    // Create a promise for the initialization
    this.browserPromise = (async () => {
      try {
        console.log('🌐 Initializing Puppeteer browser...');
        
        // Dynamically import puppeteer
        if (!this.puppeteer) {
          const puppeteerPath = path.resolve(__dirname, '../../../backend/node_modules/puppeteer/lib/cjs/puppeteer/puppeteer.js');
          const fileUrl = pathToFileURL(puppeteerPath).href;
          this.puppeteer = await import(fileUrl);
        }
        
        // Launch the browser
        this.browser = await this.puppeteer.launch({
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
        this.browser.on('disconnected', () => {
          console.log('🌐 Browser disconnected');
          this.browser = null;
          this.browserPromise = null;
          this.isInitializing = false;
        });
        
        console.log('🌐 Puppeteer browser initialized successfully');
        return this.browser;
      } catch (error) {
        console.error('🌐 Failed to initialize Puppeteer browser:', error);
        this.initializationError = error;
        this.browser = null;
        throw error;
      } finally {
        this.isInitializing = false;
      }
    })();
    
    return this.browserPromise;
  }

  /**
   * Get the browser instance, initializing it if necessary
   * @returns {Promise<Browser>} The browser instance
   */
  async getBrowser() {
    if (this.browser) {
      return this.browser;
    }
    
    if (this.initializationError) {
      console.log('🌐 Retrying browser initialization after previous failure');
    }
    
    return this.initialize();
  }

  /**
   * Create a new page in the browser
   * @returns {Promise<Page>} A new page instance
   */
  async createPage() {
    const browser = await this.getBrowser();
    return browser.newPage();
  }

  /**
   * Close the browser instance
   */
  async close() {
    if (this.browser) {
      try {
        console.log('🌐 Closing Puppeteer browser...');
        await this.browser.close();
        console.log('🌐 Puppeteer browser closed successfully');
      } catch (error) {
        console.error('🌐 Error closing Puppeteer browser:', error);
      } finally {
        this.browser = null;
        this.browserPromise = null;
        this.isInitializing = false;
      }
    }
  }

  /**
   * Check if the browser is initialized
   * @returns {boolean} True if the browser is initialized
   */
  isInitialized() {
    return !!this.browser;
  }

  /**
   * Get the initialization status
   * @returns {Object} The initialization status
   */
  getStatus() {
    return {
      initialized: !!this.browser,
      initializing: this.isInitializing,
      error: this.initializationError ? this.initializationError.message : null
    };
  }
}

// Export a singleton instance
module.exports = new BrowserService();
