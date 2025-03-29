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
 * - pptxConverterAdapter.js: PPTX conversion with slide markers
 * - PageMarkerService.js: Service for adding page/slide markers
 */

const path = require('path');
const { app } = require('electron');
const { convertUrl } = require('../adapters/urlConverterAdapter');
const { convertParentUrl } = require('../adapters/parentUrlConverterAdapter');
const FileSystemService = require('./FileSystemService');
const { textConverterFactory } = require('../adapters/textConverterFactoryAdapter');
const { getFileCategory } = require('../adapters/fileTypeUtilsAdapter');
const { extractMetadata } = require('../adapters/metadataExtractorAdapter');

/**
 * Helper function to escape special characters in strings for use in regular expressions
 * @param {string} string - The string to escape
 * @returns {string} - The escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

class ElectronConversionService {
  constructor() {
    this.fileSystem = FileSystemService;
    this.converter = textConverterFactory;
    this.progressUpdateInterval = 250; // Update progress every 250ms
    this.defaultOutputDir = path.join(app.getPath('userData'), 'conversions');
    
    // Debug logging for output directory issues
    console.log('ElectronConversionService initialized with default output directory:', this.defaultOutputDir);
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
      const category = getFileCategory(fileType, fileType);
      
      // Extract original name if it's a temporary file - do this BEFORE creating directories
      let finalBaseName = baseName;
      if (baseName.startsWith('temp_')) {
        // Extract original filename by removing 'temp_timestamp_' prefix
        finalBaseName = baseName.replace(/^temp_\d+_/, '');
        console.log(`🔄 [ElectronConversionService] Extracted original filename: ${finalBaseName} from temporary file: ${baseName}`);
      }
      
      // Check if user provided an output directory
      const userProvidedOutputDir = !!options.outputDir;
      
      // Use provided output directory or fall back to default
      const outputDir = options.outputDir || this.defaultOutputDir;
      
      // Determine if we should create a subdirectory or use the output directory directly
      // Always use direct output when user has specified a directory or for PDF files
      const isPdf = fileType.toLowerCase() === 'pdf';
      const createSubdirectory = isPdf ? false : 
                               (userProvidedOutputDir ? false : 
                               (options.createSubdirectory !== undefined ? options.createSubdirectory : true));
      
      console.log('File type detection:', {
        fileType,
        isPdf,
        createSubdirectory
      });
      
      console.log('Conversion options:', {
        userProvidedOutputDir,
        outputDir,
        createSubdirectory,
        fileName,
        finalBaseName
      });
      
      let outputBasePath;
      if (createSubdirectory) {
        // Create a timestamped subdirectory using the ORIGINAL filename (not temp)
        outputBasePath = path.join(
          outputDir,
          `${finalBaseName}_${Date.now()}`
        );
      } else {
        // Use the output directory directly
        outputBasePath = outputDir;
      }

      await this.fileSystem.createDirectory(outputBasePath);
      
      // Only create assets directories if we're creating a subdirectory
      if (createSubdirectory) {
        await this.fileSystem.createDirectory(path.join(outputBasePath, 'assets'));
        await this.fileSystem.createDirectory(path.join(outputBasePath, 'assets/images'));
      }

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

      // Read file content with proper encoding for binary files
      let fileContent;
      const isBinaryFile = ['pdf', 'docx', 'pptx', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'mp3', 'mp4', 'wav', 'webm', 'avi'].includes(fileType.toLowerCase());
      
      if (isBinaryFile) {
        // For binary files, read as buffer (null encoding)
        console.log(`🔍 [ElectronConversionService] Reading binary file with null encoding: ${fileType}`);
        fileContent = await this.fileSystem.readFile(filePath, null);
      } else {
        // For text files, use default encoding (utf8)
        console.log(`🔍 [ElectronConversionService] Reading text file with utf8 encoding: ${fileType}`);
        fileContent = await this.fileSystem.readFile(filePath);
      }
      
      if (!fileContent.success) {
        throw new Error(`Failed to read file: ${fileContent.error}`);
      }

      updateProgress(20);

      // Add detailed logging before conversion
      console.log('🔄 [ElectronConversionService] Starting conversion with textConverterFactory:', {
        fileType,
        fileName,
        contentType: typeof fileContent.data,
        isBuffer: Buffer.isBuffer(fileContent.data),
        contentLength: fileContent.data ? fileContent.data.length : 'null',
        converterType: this.converter ? (typeof this.converter === 'object' ? 'object' : typeof this.converter) : 'null',
        hasConvertToMarkdown: this.converter && typeof this.converter.convertToMarkdown === 'function'
      });
      
      // If content is a buffer, log the first few bytes to help diagnose format issues
      if (Buffer.isBuffer(fileContent.data) && fileContent.data.length > 0) {
        console.log('📊 [ElectronConversionService] Content preview (first 20 bytes):', fileContent.data.slice(0, 20).toString('hex'));
        
        // Check for PDF signature
        if (fileContent.data.length >= 5) {
          const signature = fileContent.data.slice(0, 5).toString();
          console.log(`🔍 [ElectronConversionService] File signature: ${signature}`);
          if (signature === '%PDF-') {
            console.log('✅ [ElectronConversionService] Content appears to be a valid PDF (has %PDF- signature)');
          } else {
            console.warn('⚠️ [ElectronConversionService] Content does not have a PDF signature');
          }
        }
      }

      // Convert content with enhanced error handling
      console.log(`🔄 [ElectronConversionService] Starting conversion...`);
      let conversionResult;
      try {
        conversionResult = await this.converter.convertToMarkdown(
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

        console.log('📊 [ElectronConversionService] Conversion result:', {
          success: !!conversionResult,
          hasContent: conversionResult && !!conversionResult.content,
          contentLength: conversionResult && conversionResult.content ? conversionResult.content.length : 'null',
          contentPreview: conversionResult && conversionResult.content ? 
            conversionResult.content.substring(0, 100) + '...' : 'null',
          hasImages: conversionResult && Array.isArray(conversionResult.images),
          imageCount: conversionResult && Array.isArray(conversionResult.images) ? conversionResult.images.length : 0
        });

        // Validate conversion result
        if (!conversionResult || !conversionResult.content || conversionResult.content.trim() === '') {
          console.error(`❌ [ElectronConversionService] Empty conversion result`);
          throw new Error('Conversion produced empty content');
        }
      } catch (conversionError) {
        console.error('❌ [ElectronConversionService] Conversion error:', {
          error: conversionError.message,
          stack: conversionError.stack,
          fileType,
          fileName
        });
        throw new Error(`Conversion failed: ${conversionError.message}`);
      }

      updateProgress(90);

      // Determine file paths based on whether we're using subdirectories
      let mainFilePath, imagesPath;
      
      // We already extracted the original filename earlier, no need to do it again
      
      if (createSubdirectory) {
        // Original behavior with subdirectories
        mainFilePath = path.join(outputBasePath, 'document.md');
        imagesPath = path.join(outputBasePath, 'assets/images');
      } else {
        // Save directly to output directory with original filename
        mainFilePath = path.join(outputBasePath, `${finalBaseName}.md`);
        imagesPath = outputBasePath;
      }
      
      // Log file paths
      console.log('💾 Saving conversion results to:', {
        mainFilePath,
        imagesPath
      });
      
      // Save markdown content
      await this.fileSystem.writeFile(mainFilePath, conversionResult.content);
      console.log('📝 Markdown content saved to:', mainFilePath);

      // Save images if present
      if (conversionResult.images && conversionResult.images.length > 0) {
        console.log(`🖼️ Saving ${conversionResult.images.length} images...`);
        
        // Create a {{filename}}_attachments folder for images
        const attachmentsFolder = path.join(outputBasePath, `${finalBaseName}_attachments`);
        await this.fileSystem.createDirectory(attachmentsFolder);
        console.log(`📁 Created attachments folder: ${attachmentsFolder}`);
        
        // Update markdown content to reference the new attachment folder
        let updatedContent = conversionResult.content;
        
        for (const [index, image] of conversionResult.images.entries()) {
          // Use the final base name for image filenames too
          const imageFileName = `${finalBaseName}_image_${index}${path.extname(image.name || '') || '.png'}`;
          const imagePath = path.join(attachmentsFolder, imageFileName);
          await this.fileSystem.writeFile(imagePath, image.data);
          console.log(`  - Image ${index + 1}/${conversionResult.images.length} saved to: ${imagePath}`);
          
          // Update image references in markdown content if they exist
          // Look for both Markdown and Obsidian image syntax
          const originalPath = image.path || `assets/images/${image.name}`;
          const newRelativePath = `${finalBaseName}_attachments/${imageFileName}`;
          
          // Replace Markdown image syntax: ![alt](path)
          updatedContent = updatedContent.replace(
            new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(originalPath)}\\)`, 'g'),
            `![${imageFileName}](${newRelativePath})`
          );
          
          // Replace Obsidian image syntax: ![[filename]]
          updatedContent = updatedContent.replace(
            new RegExp(`!\\[\\[${escapeRegExp(image.name || '')}\\]\\]`, 'g'),
            `![[${newRelativePath}]]`
          );
        }
        
        // Write the updated content back to the file
        await this.fileSystem.writeFile(mainFilePath, updatedContent);
        console.log(`📝 Updated markdown content with new image paths`);
        
        // Update the result content
        conversionResult.content = updatedContent;
      } else {
        console.log('ℹ️ No images to save');
      }

      // Create metadata object for return value but don't save it as a separate file
      const metadata = {
        originalFile: baseName.startsWith('temp_') ? `${finalBaseName}.${fileType}` : fileName,
        type: fileType,
        category,
        converted: new Date().toISOString(),
        imageCount: conversionResult.images?.length || 0
      };
      
      // Add page count to metadata if available
      if (conversionResult.pageCount) {
        metadata.pageCount = conversionResult.pageCount;
        console.log(`📄 [ElectronConversionService] Document has ${conversionResult.pageCount} pages`);
      }
      
      // Add slide count to metadata if available (for PPTX files)
      if (conversionResult.slideCount) {
        metadata.slideCount = conversionResult.slideCount;
        console.log(`📊 [ElectronConversionService] Presentation has ${conversionResult.slideCount} slides`);
      }
      
      console.log('📊 Metadata (included in markdown frontmatter):', metadata);

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

      // Create a batch output directory if not already specified
      const outputDir = options.outputDir || this.defaultOutputDir;
      const batchName = options.batchName || `Batch_${new Date().toISOString().replace(/:/g, '-')}`;
      const batchOutputPath = path.join(outputDir, batchName);
      
      // Ensure the batch directory exists
      await this.fileSystem.createDirectory(batchOutputPath);
      
      // Create a summary file with information about the batch conversion
      const summaryContent = [
        '# Batch Conversion Summary',
        '',
        `- **Date:** ${new Date().toISOString()}`,
        `- **Total Files:** ${results.length}`,
        `- **Successfully Converted:** ${results.filter(r => r.success).length}`,
        `- **Failed:** ${results.filter(r => !r.success).length}`,
        `- **Duration:** ${Math.round((Date.now() - startTime)/1000)} seconds`,
        '',
        '## Files',
        '',
        ...results.map((result, index) => {
          const fileName = path.basename(filePaths[index]);
          const status = result.success ? '✅ Success' : `❌ Failed: ${result.error || 'Unknown error'}`;
          return `- **${fileName}**: ${status}`;
        })
      ].join('\n');
      
      // Write the summary file
      await this.fileSystem.writeFile(
        path.join(batchOutputPath, 'batch-summary.md'),
        summaryContent
      );
      
      const endMemory = process.memoryUsage();
      console.log('✅ Batch conversion completed:', {
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        duration: `${Math.round((Date.now() - startTime)/1000)}s`,
        memoryUsed: `${Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)}MB`,
        batchOutputPath
      });

      return {
        success: true,
        outputPath: batchOutputPath, // Add the output path to the result
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
      
      // Check if user provided an output directory
      const userProvidedOutputDir = !!options.outputDir;
      
      // Use provided output directory or fall back to default
      const outputDir = options.outputDir || this.defaultOutputDir;
      
      // Determine if we should create a subdirectory or use the output directory directly
      // Always use direct output when user has specified a directory
      const createSubdirectory = userProvidedOutputDir ? false : 
                               (options.createSubdirectory !== undefined ? options.createSubdirectory : true);
      
      console.log('URL Conversion options:', {
        userProvidedOutputDir,
        outputDir,
        createSubdirectory,
        url
      });
      
      let outputBasePath;
      if (createSubdirectory) {
        // Create a timestamped subdirectory (original behavior)
        outputBasePath = path.join(
          outputDir,
          `${baseName}_${Date.now()}`
        );
      } else {
        // Use the output directory directly
        outputBasePath = outputDir;
      }

      await this.fileSystem.createDirectory(outputBasePath);
      
      // Only create assets directories if we're creating a subdirectory
      if (createSubdirectory) {
        await this.fileSystem.createDirectory(path.join(outputBasePath, 'assets'));
        await this.fileSystem.createDirectory(path.join(outputBasePath, 'assets/images'));
      }

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

      // Use the URL converter adapter to convert the URL
      const conversionResult = await convertUrl(url, {
        ...options,
        includeImages: true,
        includeMeta: true
      });

      if (!conversionResult || !conversionResult.content) {
        throw new Error('URL conversion failed: Invalid result from adapter');
      }

      updateProgress(90);

      // Determine file paths based on whether we're using subdirectories
      let mainFilePath;
      
      if (createSubdirectory) {
        // Original behavior with subdirectories
        mainFilePath = path.join(outputBasePath, 'document.md');
      } else {
        // Save directly to output directory with hostname as filename
        mainFilePath = path.join(outputBasePath, `${baseName}.md`);
      }
      
      // Save markdown content
      await this.fileSystem.writeFile(mainFilePath, conversionResult.content);

      // Create metadata object for return value but don't save it as a separate file
      const metadataObj = {
        originalUrl: url,
        title: conversionResult.metadata?.title || hostname,
        hostname,
        converted: new Date().toISOString(),
        imageCount: conversionResult.images?.length || 0
      };
      
      // Add page count to metadata if available
      if (conversionResult.pageCount) {
        metadataObj.pageCount = conversionResult.pageCount;
        console.log(`📄 [ElectronConversionService] URL document has ${conversionResult.pageCount} pages`);
      } else {
        // For single URLs, set page count to 1
        metadataObj.pageCount = 1;
        console.log(`📄 [ElectronConversionService] Single URL document (1 page)`);
      }
      
      console.log('📊 Metadata (included in markdown frontmatter):', metadataObj);

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
        images: conversionResult.images
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
      
      // Check if user provided an output directory
      const userProvidedOutputDir = !!options.outputDir;
      
      // Use provided output directory or fall back to default
      const outputDir = options.outputDir || this.defaultOutputDir;
      
      // Determine if we should create a subdirectory or use the output directory directly
      // Always use direct output when user has specified a directory
      const createSubdirectory = userProvidedOutputDir ? false : 
                               (options.createSubdirectory !== undefined ? options.createSubdirectory : true);
      
      console.log('Parent URL Conversion options:', {
        userProvidedOutputDir,
        outputDir,
        createSubdirectory,
        url
      });
      
      let outputBasePath;
      if (createSubdirectory) {
        // Create a timestamped subdirectory (original behavior)
        outputBasePath = path.join(
          outputDir,
          `${hostname}_site_${Date.now()}`
        );
      } else {
        // Use the output directory directly
        outputBasePath = outputDir;
      }

      await this.fileSystem.createDirectory(outputBasePath);
      
      // Create necessary subdirectories
      if (createSubdirectory) {
        await this.fileSystem.createDirectory(path.join(outputBasePath, 'pages'));
        await this.fileSystem.createDirectory(path.join(outputBasePath, 'assets'));
        await this.fileSystem.createDirectory(path.join(outputBasePath, 'assets/images'));
      }

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

      updateProgress(10);

      // Use the parent URL converter adapter to convert the URL
      const conversionResult = await convertParentUrl(url, {
        ...options,
        includeImages: true,
        includeMeta: true
      });

      if (!conversionResult || !conversionResult.content) {
        throw new Error('Parent URL conversion failed: Invalid result from adapter');
      }

      updateProgress(90);

      // Save the files from the conversion result
      if (conversionResult.files && conversionResult.files.length > 0) {
        for (const file of conversionResult.files) {
          const filePath = path.join(outputBasePath, file.name);
          const fileDir = path.dirname(filePath);
          
          // Ensure directory exists
          await this.fileSystem.createDirectory(fileDir);
          
          // Write file content
          await this.fileSystem.writeFile(filePath, file.content);
        }
      }

      // Determine the main file path
      const mainFilePath = path.join(outputBasePath, 'index.md');

      updateProgress(100);

      const endMemory = process.memoryUsage();
      console.log('✅ Parent URL conversion completed:', {
        url,
        duration: `${Date.now() - startTime}ms`,
        memoryUsed: `${Math.round((endMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)}MB`,
        totalPages: conversionResult.stats?.totalPages || 1,
        successfulPages: conversionResult.stats?.successfulPages || 1
      });

      // Create metadata object with page count information
      const metadata = {
        originalUrl: url,
        hostname,
        converted: new Date().toISOString(),
        totalPages: conversionResult.stats?.totalPages || 1,
        successfulPages: conversionResult.stats?.successfulPages || 1,
        failedPages: conversionResult.stats?.failedPages || 0
      };
      
      // Add page count to metadata if available
      if (conversionResult.pageCount) {
        metadata.pageCount = conversionResult.pageCount;
        console.log(`📄 [ElectronConversionService] Parent URL document has ${conversionResult.pageCount} pages`);
      } else {
        // Use totalPages as pageCount if not explicitly set
        metadata.pageCount = conversionResult.stats?.totalPages || 1;
        console.log(`📄 [ElectronConversionService] Parent URL document has ${metadata.pageCount} pages (from stats)`);
      }
      
      console.log('📊 Metadata (included in markdown frontmatter):', metadata);
      
      return {
        success: true,
        outputPath: outputBasePath,
        mainFile: mainFilePath,
        metadata
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
   * @param {string} outputDir - The output directory to set up
   */
  async setupOutputDirectory(outputDir) {
    try {
      const dirToSetup = outputDir || this.defaultOutputDir;
      await this.fileSystem.createDirectory(dirToSetup);
      console.log('📁 Output directory ready:', dirToSetup);
    } catch (error) {
      console.error('❌ Failed to set up output directory:', error);
      throw error;
    }
  }
}

module.exports = new ElectronConversionService();
