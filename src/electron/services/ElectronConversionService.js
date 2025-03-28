/**
 * ElectronConversionService.js
 * Handles document conversion using native file system operations in Electron.
 * 
 * This service replaces the Express-based ConversionService with a native
 * implementation that uses direct file system access and manages conversions
 * within the Electron main process.
 * 
 * Related files:
 * - FileSystemService.js: Native file operations
 * - textConverterFactory.js: Converter implementations
 * - JobManager.js: Progress tracking
 * - urlConverter.js: URL conversion
 * - parentUrlConverter.js: Parent URL conversion
 * - youtubeConverter.js: YouTube conversion
 */

const path = require('path');
const { app } = require('electron');
const got = require('got');
const TurndownService = require('turndown');
const cheerio = require('cheerio');
const FileSystemService = require('./FileSystemService');
const { textConverterFactory } = require('../adapters/textConverterFactoryAdapter');
const { determineCategory } = require('../adapters/fileTypeUtilsAdapter');
const { extractMetadata } = require('../adapters/metadataExtractorAdapter');

class ElectronConversionService {
  constructor() {
    this.fileSystem = FileSystemService;
    this.converter = textConverterFactory;
    this.progressUpdateInterval = 250; // Update progress every 250ms
    this.outputDir = path.join(app.getPath('userData'), 'conversions');
  }

  /**
   * Converts a file to markdown format
   * @param {string} filePath Path to input file
   * @param {Object} options Conversion options
   * @returns {Promise<{success: boolean, outputPath?: string, error?: string}>}
   */
  async convert(filePath, options = {}) {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();
    let lastProgressUpdate = 0;

    try {
      // Validate file exists
      const fileStats = await this.fileSystem.getStats(filePath);
      if (!fileStats.success) {
        throw new Error(`File not found or inaccessible: ${filePath}`);
      }

      // Create output directory structure
      const fileName = path.basename(filePath);
      const fileType = path.extname(fileName).slice(1).toLowerCase();
      const baseName = path.basename(fileName, path.extname(fileName));
      const category = determineCategory(fileType, fileType);
      
      const outputBasePath = path.join(
        this.outputDir,
        `${baseName}_${Date.now()}`
      );

      await this.fileSystem.createDirectory(outputBasePath);
      await this.fileSystem.createDirectory(path.join(outputBasePath, 'assets'));
      await this.fileSystem.createDirectory(path.join(outputBasePath, 'assets/images'));

      console.log('📁 Set up output structure:', {
        input: fileName,
        outputPath: outputBasePath,
        type: fileType,
        category,
        size: fileStats.stats.size,
        initialMemory: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`
      });

      // Progress tracking function
      const updateProgress = (progress) => {
        const now = Date.now();
        if (options.onProgress && now - lastProgressUpdate >= this.progressUpdateInterval) {
          options.onProgress(Math.min(Math.round(progress), 100));
          lastProgressUpdate = now;
        }
      };

      // Read file content
      const fileContent = await this.fileSystem.readFile(filePath);
      if (!fileContent.success) {
        throw new Error(`Failed to read file: ${fileContent.error}`);
      }

      updateProgress(20);

      // Convert content
      const conversionResult = await this.converter.convertToMarkdown(
        fileType,
        fileContent.data,
        {
          name: fileName,
          ...options,
          onProgress: (progress) => {
            // Scale progress from 20-90%
            const scaledProgress = 20 + (progress * 0.7);
            updateProgress(scaledProgress);
          }
        }
      );

      if (!conversionResult || !conversionResult.content) {
        throw new Error('Conversion failed: Invalid result');
      }

      updateProgress(90);

      // Save markdown content
      const mainFilePath = path.join(outputBasePath, 'document.md');
      await this.fileSystem.writeFile(mainFilePath, conversionResult.content);

      // Save images if present
      if (conversionResult.images && conversionResult.images.length > 0) {
        for (const [index, image] of conversionResult.images.entries()) {
          const imageFileName = `image_${index}${path.extname(image.name || '') || '.png'}`;
          const imagePath = path.join(outputBasePath, 'assets/images', imageFileName);
          await this.fileSystem.writeFile(imagePath, image.data);
        }
      }

      // Save metadata
      const metadata = {
        originalFile: fileName,
        type: fileType,
        category,
        converted: new Date().toISOString(),
        imageCount: conversionResult.images?.length || 0
      };

      await this.fileSystem.writeFile(
        path.join(outputBasePath, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      updateProgress(100);

      const endMemory = process.memoryUsage();
      console.log('✅ Conversion completed:', {
        file: fileName,
        duration: `${Date.now() - startTime}ms`,
        memoryUsed: `${Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)}MB`
      });

      return {
        success: true,
        outputPath: outputBasePath,
        mainFile: mainFilePath,
        metadata
      };

    } catch (error) {
      console.error('❌ Conversion failed:', {
        file: filePath,
        error: error.message,
        duration: `${Date.now() - startTime}ms`
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Converts multiple files in sequence
   * @param {string[]} filePaths Array of file paths
   * @param {Object} options Conversion options
   * @returns {Promise<{success: boolean, results: Array, error?: string}>}
   */
  async convertBatch(filePaths, options = {}) {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();
    const results = [];
    const CHUNK_SIZE = 5;

    console.log('🎯 Starting batch conversion:', {
      totalFiles: filePaths.length,
      initialMemory: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`
    });

    try {
      // Process files in chunks to manage memory
      for (let i = 0; i < filePaths.length; i += CHUNK_SIZE) {
        const chunk = filePaths.slice(i, i + CHUNK_SIZE);
        console.log(`📦 Processing chunk ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(filePaths.length/CHUNK_SIZE)}`);

        // Convert files in current chunk
        const chunkResults = await Promise.all(
          chunk.map(async (filePath) => {
            try {
              return await this.convert(filePath, {
                ...options,
                onProgress: (progress) => {
                  if (options.onProgress) {
                    options.onProgress({
                      file: path.basename(filePath),
                      progress,
                      index: i
                    });
                  }
                }
              });
            } catch (error) {
              return {
                success: false,
                file: filePath,
                error: error.message
              };
            }
          })
        );

        results.push(...chunkResults);

        // Optional garbage collection between chunks
        if (global.gc && process.memoryUsage().heapUsed > 512 * 1024 * 1024) {
          global.gc();
        }
      }

      const endMemory = process.memoryUsage();
      console.log('✅ Batch conversion completed:', {
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        duration: `${Math.round((Date.now() - startTime)/1000)}s`,
        memoryUsed: `${Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)}MB`
      });

      return {
        success: true,
        results,
        stats: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          duration: Date.now() - startTime
        }
      };

    } catch (error) {
      console.error('❌ Batch conversion failed:', error);
      return {
        success: false,
        error: error.message,
        results
      };
    }
  }

  /**
   * Converts a URL to markdown format
   * @param {string} url URL to convert
   * @param {Object} options Conversion options
   * @returns {Promise<{success: boolean, outputPath?: string, error?: string}>}
   */
  async convertUrl(url, options = {}) {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();
    let lastProgressUpdate = 0;

    try {
      // Validate URL
      let urlObj;
      try {
        urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          throw new Error('Only HTTP and HTTPS protocols are supported');
        }
      } catch (error) {
        throw new Error(`Invalid URL: ${error.message}`);
      }

      // Create output directory structure
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname.replace(/\//g, '_').replace(/^_|_$/g, '') || 'index';
      const baseName = `${hostname}${pathname ? '_' + pathname : ''}`;
      
      const outputBasePath = path.join(
        this.outputDir,
        `${baseName}_${Date.now()}`
      );

      await this.fileSystem.createDirectory(outputBasePath);
      await this.fileSystem.createDirectory(path.join(outputBasePath, 'assets'));
      await this.fileSystem.createDirectory(path.join(outputBasePath, 'assets/images'));

      console.log('📁 Set up output structure for URL:', {
        url,
        outputPath: outputBasePath,
        initialMemory: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`
      });

      // Progress tracking function
      const updateProgress = (progress) => {
        const now = Date.now();
        if (options.onProgress && now - lastProgressUpdate >= this.progressUpdateInterval) {
          options.onProgress(Math.min(Math.round(progress), 100));
          lastProgressUpdate = now;
        }
      };

      updateProgress(10);

      // Fetch URL content
      const response = await got(url, {
        timeout: {
          request: 30000,
          response: 30000
        },
        retry: {
          limit: 3,
          statusCodes: [408, 413, 429, 500, 502, 503, 504],
          methods: ['GET'],
          calculateDelay: ({retryCount}) => retryCount * 1000
        },
        headers: {
          'accept': 'text/html,application/xhtml+xml',
          'accept-encoding': 'gzip, deflate',
          'accept-language': 'en-US,en;q=0.9',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        throwHttpErrors: false,
        followRedirect: true,
        decompress: true,
        responseType: 'text'
      });

      if (!response.statusCode || response.statusCode >= 400) {
        throw new Error(`Failed to fetch URL: HTTP ${response.statusCode}`);
      }

      updateProgress(30);

      // Parse HTML
      const $ = cheerio.load(response.body);

      // Remove unnecessary elements
      const removeSelectors = [
        'script', 'style', 'iframe', 'noscript',
        'header nav', 'footer nav', 'aside',
        '.ads', '.social-share', '.comments',
        '.navigation', '.menu', '.widget'
      ];

      removeSelectors.forEach(selector => {
        $(selector).remove();
      });

      // Find main content
      const contentSelectors = [
        'article', 'main', '[role="main"]',
        '.post-content', '.entry-content', '.article-content',
        '.content', '#content', '#main', 'body'
      ];

      let $content = null;
      for (const selector of contentSelectors) {
        const $found = $(selector);
        if ($found.length) {
          $content = $found;
          break;
        }
      }
      $content = $content || $('body');

      updateProgress(50);

      // Replace all img tags with markdown syntax
      const images = [];
      $content.find('img').each((_, img) => {
        const $img = $(img);
        const src = $img.attr('src');
        if (src) {
          const alt = $img.attr('alt') || '';
          const imgUrl = new URL(src, url).href;
          const markdown = `\n![${alt}](${imgUrl})\n`;
          $img.replaceWith(markdown);
          
          images.push({
            url: imgUrl,
            alt,
            name: path.basename(imgUrl)
          });
        }
      });

      updateProgress(70);

      // Convert HTML to Markdown
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        hr: '---',
        strongDelimiter: '**',
        emDelimiter: '*'
      });

      // Add basic rules
      turndownService.addRule('tables', {
        filter: ['table'],
        replacement: (content) => content
      });

      turndownService.addRule('codeBlocks', {
        filter: ['pre'],
        replacement: (content) => `\n\`\`\`\n${content}\n\`\`\`\n`
      });

      turndownService.addRule('lineBreaks', {
        filter: ['br'],
        replacement: () => '\n'
      });

      const markdown = turndownService.turndown($content.html())
        .replace(/\n{3,}/g, '\n\n')  // Remove extra newlines
        .replace(/!\\\[/g, '![')     // Fix escaped opening brackets
        .replace(/\\\]/g, ']')       // Fix escaped closing brackets
        .trim();

      updateProgress(80);

      // Extract metadata
      let metadata = null;
      if (options.includeMeta !== false) {
        try {
          metadata = await extractMetadata(url);
        } catch (error) {
          console.error('Metadata extraction failed:', error);
        }
      }

      updateProgress(90);

      // Combine metadata and markdown
      const content = [
        metadata ? [
          '---',
          Object.entries(metadata)
            .map(([key, value]) => `${key}: "${value?.toString()?.replace(/"/g, '\\"') || ''}"`)
            .join('\n'),
          '---'
        ].join('\n') : null,
        markdown
      ].filter(Boolean).join('\n\n');

      // Save markdown content
      const mainFilePath = path.join(outputBasePath, 'document.md');
      await this.fileSystem.writeFile(mainFilePath, content);

      // Save metadata
      const metadataObj = {
        originalUrl: url,
        title: metadata?.title || hostname,
        hostname,
        converted: new Date().toISOString(),
        imageCount: images.length
      };

      await this.fileSystem.writeFile(
        path.join(outputBasePath, 'metadata.json'),
        JSON.stringify(metadataObj, null, 2)
      );

      updateProgress(100);

      const endMemory = process.memoryUsage();
      console.log('✅ URL conversion completed:', {
        url,
        duration: `${Date.now() - startTime}ms`,
        memoryUsed: `${Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)}MB`
      });

      return {
        success: true,
        outputPath: outputBasePath,
        mainFile: mainFilePath,
        metadata: metadataObj,
        images
      };

    } catch (error) {
      console.error('❌ URL conversion failed:', {
        url,
        error: error.message,
        duration: `${Date.now() - startTime}ms`
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Converts a YouTube URL to markdown format
   * @param {string} url YouTube URL to convert
   * @param {Object} options Conversion options
   * @returns {Promise<{success: boolean, outputPath?: string, error?: string}>}
   */
  async convertYoutube(url, options = {}) {
    // YouTube functionality temporarily disabled
    return {
      success: false,
      error: 'YouTube conversion temporarily disabled'
    };
  }

  /**
   * Converts a parent URL and its child pages to markdown format
   * @param {string} url Parent URL to convert
   * @param {Object} options Conversion options
   * @returns {Promise<{success: boolean, outputPath?: string, error?: string}>}
   */
  async convertParentUrl(url, options = {}) {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();
    let lastProgressUpdate = 0;

    try {
      // Validate URL
      let urlObj;
      try {
        urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          throw new Error('Only HTTP and HTTPS protocols are supported');
        }
      } catch (error) {
        throw new Error(`Invalid URL: ${error.message}`);
      }

      // Create output directory structure
      const hostname = urlObj.hostname;
      const outputBasePath = path.join(
        this.outputDir,
        `${hostname}_site_${Date.now()}`
      );

      await this.fileSystem.createDirectory(outputBasePath);
      await this.fileSystem.createDirectory(path.join(outputBasePath, 'pages'));
      await this.fileSystem.createDirectory(path.join(outputBasePath, 'assets'));
      await this.fileSystem.createDirectory(path.join(outputBasePath, 'assets/images'));

      console.log('📁 Set up output structure for parent URL:', {
        url,
        outputPath: outputBasePath,
        initialMemory: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`
      });

      // Progress tracking function
      const updateProgress = (progress) => {
        const now = Date.now();
        if (options.onProgress && now - lastProgressUpdate >= this.progressUpdateInterval) {
          options.onProgress(Math.min(Math.round(progress), 100));
          lastProgressUpdate = now;
        }
      };

      updateProgress(5);

      // First convert the parent URL itself
      const parentResult = await this.convertUrl(url, {
        ...options,
        onProgress: (progress) => {
          // Scale progress from 5-20%
          const scaledProgress = 5 + (progress * 0.15);
          updateProgress(scaledProgress);
        }
      });

      if (!parentResult.success) {
        throw new Error(`Failed to convert parent URL: ${parentResult.error}`);
      }

      // Save parent page
      const parentPagePath = path.join(outputBasePath, 'pages', 'index.md');
      await this.fileSystem.writeFile(parentPagePath, parentResult.content || '');

      updateProgress(20);

      // For now, we'll implement a simplified version that just converts the parent URL
      // A full implementation would crawl the site and convert all pages
      
      // Generate index file
      const indexContent = [
        `---`,
        `title: "${hostname} Archive"`,
        `description: "Website archive of ${hostname}"`,
        `date: "${new Date().toISOString()}"`,
        `source: "${url}"`,
        `archived_at: "${new Date().toISOString()}"`,
        `tags:`,
        `  - website-archive`,
        `  - ${hostname.replace(/\./g, '-')}`,
        `---`,
        '',
        `# ${hostname} Website Archive`,
        '',
        '## Site Information',
        `- **Source URL:** ${url}`,
        `- **Archived:** ${new Date().toISOString()}`,
        `- **Total Pages:** 1`,
        `- **Successful:** 1`,
        `- **Failed:** 0`,
        '',
        '## Successfully Converted Pages',
        '',
        `- [[pages/index|Home Page]] - [Original](${url})`,
        '',
        '## Notes',
        '',
        '- All pages are stored in the `pages/` folder',
        '- Internal links are preserved as wiki-links',
        '- Original URLs are preserved in page metadata',
        '- Images are linked to their original source URLs',
        '- Generated with Obsidian Note Converter'
      ].join('\n');

      // Save index file
      const indexPath = path.join(outputBasePath, 'index.md');
      await this.fileSystem.writeFile(indexPath, indexContent);

      updateProgress(100);

      const endMemory = process.memoryUsage();
      console.log('✅ Parent URL conversion completed:', {
        url,
        duration: `${Date.now() - startTime}ms`,
        memoryUsed: `${Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)}MB`
      });

      return {
        success: true,
        outputPath: outputBasePath,
        mainFile: indexPath,
        metadata: {
          originalUrl: url,
          hostname,
          converted: new Date().toISOString(),
          totalPages: 1,
          successfulPages: 1,
          failedPages: 0
        }
      };

    } catch (error) {
      console.error('❌ Parent URL conversion failed:', {
        url,
        error: error.message,
        duration: `${Date.now() - startTime}ms`
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sets up the output directory for conversions
   * @private
   */
  async setupOutputDirectory() {
    try {
      await this.fileSystem.createDirectory(this.outputDir);
      console.log('📁 Output directory ready:', this.outputDir);
    } catch (error) {
      console.error('❌ Failed to set up output directory:', error);
      throw error;
    }
  }
}

module.exports = new ElectronConversionService();
