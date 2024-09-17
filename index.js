// index.js

import { readFile, writeFile, readdir } from 'fs/promises';
import { parse } from 'csv-parse/sync';
import { enhanceNote } from './src/enhancer.js';
import { convertToMarkdown } from './src/converter.js';
import { scrapeYouTubeTranscript, scrapeWebsiteText } from './src/scraper.js';
import path from 'path';
import pdfParse from 'pdf-parse';

export const INPUT_DIR = './input';
const OUTPUT_DIR = './output';
const URL_CSV_FILE = 'urls.csv';



async function processInputs() {
  try {
    const files = await readdir(INPUT_DIR);
    for (const file of files) {
      const filePath = path.join(INPUT_DIR, file);
      if (file === URL_CSV_FILE) {
        await processCsvFile(filePath);
      } else {
        await processFile(filePath);
      }
    }
  } catch (error) {
    console.error('Error processing inputs:', error);
  }
}

async function processCsvFile(filePath) {
  try {
    const fileContent = await readFile(filePath, 'utf-8');
    const records = parse(fileContent, { columns: true, skip_empty_lines: true });
    for (const record of records) {
      try {
        const { input, outputName } = record;
        console.log(`Processing URL from CSV: ${input}`);
        const content = await processInput(input);
        const enhancedContent = await enhanceNote(content, outputName || getFileName(input));
        await saveOutput(enhancedContent, outputName);
        console.log(`Processed and saved: ${outputName}`);
      } catch (error) {
        console.error(`Error processing ${record.input}:`, error);
      }
    }
  } catch (error) {
    console.error('Error reading or parsing CSV file:', error);
  }
}

async function processFile(filePath) {
  try {
    console.log(`Processing file: ${filePath}`);
    const fileExt = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath, fileExt);

    let content;
    if (fileExt === '.pdf') {
      const fileBuffer = await readFile(filePath);
      const pdfData = await pdfParse(fileBuffer);
      content = pdfData.text;
    } else {
      content = await convertToMarkdown(filePath, fileExt.slice(1));
    }

    const enhancedContent = await enhanceNote(content, fileName);
    await saveOutput(enhancedContent, fileName);
    console.log(`Processed and saved: ${fileName}`);
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

async function processInput(input) {
  if (isURL(input)) {
    if (isYouTubeURL(input)) {
      console.log('Processing YouTube URL');
      return await scrapeYouTubeTranscript(input);
    } else {
      console.log('Processing general website URL');
      return await scrapeWebsiteText(input);
    }
  } else {
    throw new Error('Invalid input in CSV: not a URL');
  }
}

function isURL(input) {
  return input.startsWith('http://') || input.startsWith('https://') || input.startsWith('www.');
}

function isYouTubeURL(url) {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

function getFileName(input) {
  return path.basename(input, path.extname(input));
}

async function saveOutput(content, outputName) {
  const outputPath = path.join(OUTPUT_DIR, `${outputName}.md`);
  await writeFile(outputPath, content);
}

// Main execution
(async () => {
  try {
    console.log('Starting input processing');
    await processInputs();
    console.log('Input processing completed');
  } catch (error) {
    console.error('Error in main execution:', error);
  }
})();