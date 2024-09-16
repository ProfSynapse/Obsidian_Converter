// index.js - Main entry point for Obsidian Note Enhancer

import { readdir, readFile, writeFile } from 'fs/promises';
import { extname, basename, join, resolve } from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { PDFExtract } from 'pdf.js-extract';
import { convertToMarkdown } from './converter.js';
import { enhanceNote } from './enhancer.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('--- Starting Obsidian Note Enhancer ---');
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

// Load environment variables
console.log('Attempting to load .env file...');
const envPath = resolve(__dirname, '../.env');
console.log('Looking for .env file at:', envPath);

const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Error loading .env file:', result.error);
} else {
  console.log('.env file loaded successfully');
}

console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'Is set' : 'Is not set');

if (!process.env.OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY is not set. Please check your .env file.');
  process.exit(1);
}

// Define input and output directories
const inputFolder = resolve(__dirname, '../input');
const outputFolder = resolve(__dirname, '../output');

console.log('Input folder:', inputFolder);
console.log('Output folder:', outputFolder);

const pdfExtract = new PDFExtract();

/**
 * Convert PDF to text
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<string>} Extracted text from PDF
 */
async function convertPdfToText(buffer) {
  console.log('Converting PDF to text...');
  try {
    const data = await pdfExtract.extractBuffer(buffer, {});
    console.log('PDF conversion successful');
    return data.pages.map(page => page.content.map(item => item.str).join(' ')).join('\n\n');
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw error;
  }
}

/**
 * Main function to process files
 */
async function processFiles() {
  console.log('Starting file processing...');
  try {
    console.log(`Reading files from: ${inputFolder}`);
    // Read all files from the input directory
    const files = await readdir(inputFolder);
    
    if (files.length === 0) {
      console.log('No files found in the input directory.');
      return;
    }

    console.log(`Found ${files.length} files in the input directory.`);

    // Process each file
    for (const file of files) {
      console.log(`Processing file: ${file}`);
      
      // Construct full file path
      const filePath = join(inputFolder, file);
      
      try {
        // Read file content as a buffer
        console.log(`Reading file: ${filePath}`);
        const fileBuffer = await readFile(filePath);
        
        // Determine file type
        console.log('Determining file type...');
        const fileType = await fileTypeFromBuffer(fileBuffer);
        
        let markdownContent;
        
        // Convert file content to markdown based on file type
        if (fileType && fileType.ext === 'pdf') {
          console.log('PDF file detected. Converting to markdown...');
          const pdfText = await convertPdfToText(fileBuffer);
          markdownContent = pdfText;
        } else {
          console.log(`Converting ${fileType ? fileType.ext : extname(file).slice(1)} file to markdown...`);
          markdownContent = await convertToMarkdown(fileBuffer, fileType ? fileType.ext : extname(file).slice(1));
        }
        
        console.log('Enhancing markdown content...');
        // Enhance the markdown content (add front matter and wikilinks)
        const enhancedContent = await enhanceNote(markdownContent, basename(file, extname(file)));
        
        // Construct output file path
        const outputFilePath = join(outputFolder, `${basename(file, extname(file))}.md`);
        
        // Write the enhanced content to the output file
        console.log(`Writing enhanced content to: ${outputFilePath}`);
        await writeFile(outputFilePath, enhancedContent);
        
        console.log(`Enhanced markdown file created: ${outputFilePath}`);
      } catch (fileError) {
        console.error(`Error processing file ${file}:`, fileError);
      }
    }
  } catch (error) {
    console.error('Error processing files:', error);
  }
}

// Execute the main function
console.log('Executing main function...');
processFiles().then(() => {
  console.log('File processing completed.');
}).catch((error) => {
  console.error('An error occurred during file processing:', error);
});