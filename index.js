// index.js
import { fileURLToPath } from 'url';
import { dirname, join, resolve, extname, basename } from 'path';
import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { fileTypeFromBuffer } from 'file-type';
import { PDFExtract } from 'pdf.js-extract';
import { convertToMarkdown } from './src/converter.js';
import { enhanceNote } from './src/enhancer.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '.env') });

const pdfExtract = new PDFExtract();

async function convertPdfToText(buffer) {
  try {
    const data = await pdfExtract.extractBuffer(buffer, {});
    return data.pages.map(page => page.content.map(item => item.str).join(' ')).join('\n\n');
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw error;
  }
}

async function processFile(filePath) {
  try {
    const fileBuffer = await readFile(filePath);
    const fileType = await fileTypeFromBuffer(fileBuffer);
    const fileExtension = fileType ? fileType.ext : extname(filePath).slice(1);
    
    console.log(`Processing file: ${filePath}`);
    console.log(`Detected file type: ${fileExtension}`);
    
    let markdownContent;
    if (fileExtension === 'pdf') {
      const pdfText = await convertPdfToText(fileBuffer);
      markdownContent = pdfText;
    } else if (['mp3', 'wav', 'm4a', 'ogg', 'mp4', 'mov', 'avi', 'webm'].includes(fileExtension)) {
      markdownContent = await convertToMarkdown(fileBuffer, fileExtension);
    } else {
      markdownContent = await convertToMarkdown(fileBuffer, fileExtension);
    }
    
    const enhancedContent = await enhanceNote(markdownContent, basename(filePath, extname(filePath)));
    
    const outputFolder = resolve(__dirname, 'output');
    if (!existsSync(outputFolder)) {
      mkdirSync(outputFolder);
    }
    const outputFilePath = join(outputFolder, `${basename(filePath, extname(filePath))}.md`);
    
    await writeFile(outputFilePath, enhancedContent);
    
    console.log(`File processed successfully: ${outputFilePath}`);
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

async function processAllFiles() {
  try {
    const inputFolder = resolve(__dirname, 'input');
    const files = await readdir(inputFolder);
    
    const processingPromises = files.map(async (file) => {
      const filePath = join(inputFolder, file);
      await processFile(filePath);
    });

    await Promise.all(processingPromises);
    console.log('All files processed successfully.');
  } catch (error) {
    console.error('Error processing files:', error);
  }
}

// Main execution
const inputFolder = resolve(__dirname, 'input');
if (!existsSync(inputFolder)) {
  mkdirSync(inputFolder);
  console.log('Input folder created. Please add files to process.');
  process.exit(0);
}

// Process all files in the input folder
processAllFiles();