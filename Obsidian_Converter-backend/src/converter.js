// converter.js
import { transcribeAudio, transcribeVideo } from './transcriber.js';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { fileTypeFromBuffer } from 'file-type';
import tmp from 'tmp';
import pdfParse from 'pdf-parse';
import { INPUT_DIR } from '../index.js';

tmp.setGracefulCleanup();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let htmlToMarkdown, mammoth, rtfToHTML;

try {
  htmlToMarkdown = await import('html-to-markdown');
} catch (error) {
  console.warn('html-to-markdown package not found. HTML conversion will be limited.');
}

try {
  mammoth = await import('mammoth');
} catch (error) {
  console.warn('mammoth package not found. DOCX conversion will not be available.');
}

try {
  rtfToHTML = await import('@iarna/rtf-to-html');
} catch (error) {
  console.warn('@iarna/rtf-to-html package not found. RTF conversion will not be available.');
}

/**
 * Convert a file to markdown based on its file type
 * @param {string} filePath - The path to the file
 * @param {string} fileType - The file extension or type
 * @returns {Promise<string>} The file content converted to markdown
 */
export async function convertToMarkdown(filePath, fileType, apiKey) {
  const fileBuffer = await readFile(filePath);
  const detectedType = await fileTypeFromBuffer(fileBuffer);
  const actualFileType = detectedType ? detectedType.ext : fileType.toLowerCase();
  console.log(`Converting file of type: ${actualFileType}`);

  switch (actualFileType) {
    case 'txt':
      return convertTextToMarkdown(fileBuffer);
    case 'html':
    case 'htm':
      return convertHtmlToMarkdown(fileBuffer);
    case 'docx':
      return convertDocxToMarkdown(fileBuffer);
    case 'rtf':
      return convertRtfToMarkdown(fileBuffer);
    case 'pdf':
      return convertPdfToMarkdown(filePath);
    case 'mp3':
    case 'wav':
    case 'm4a':
    case 'ogg':
      return await convertAudioToMarkdown(fileBuffer, actualFileType);
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'webm':
      return await convertVideoToMarkdown(fileBuffer, actualFileType);
    default:
      console.warn(`Unsupported file type: ${actualFileType}. Treating as plain text.`);
      return convertTextToMarkdown(fileBuffer);
  }
}

function convertTextToMarkdown(buffer) {
  return buffer.toString('utf-8');
}

async function convertHtmlToMarkdown(buffer) {
  const htmlContent = buffer.toString('utf-8');
  if (htmlToMarkdown) {
    return htmlToMarkdown.convert(htmlContent);
  } else {
    console.warn('HTML to Markdown conversion not available. Returning raw HTML.');
    return htmlContent;
  }
}

async function convertDocxToMarkdown(buffer) {
  if (mammoth) {
    try {
      console.log('Starting DOCX conversion');
      const result = await mammoth.convertToMarkdown({ buffer });
      console.log('DOCX conversion successful');
      return result.value;
    } catch (error) {
      console.error('Error in DOCX conversion:', error);
      if (error.message.includes('Corrupted zip')) {
        console.log('Attempting to read file as plain text...');
        return buffer.toString('utf-8');
      }
      throw error;
    }
  } else {
    throw new Error('DOCX conversion is not available. Please install the mammoth package.');
  }
}

async function convertRtfToMarkdown(buffer) {
  if (rtfToHTML && htmlToMarkdown) {
    const rtfContent = buffer.toString('utf-8');
    const htmlContent = await new Promise((resolve, reject) => {
      rtfToHTML.fromString(rtfContent, (err, html) => {
        if (err) reject(err);
        else resolve(html);
      });
    });
    return htmlToMarkdown.convert(htmlContent);
  } else {
    throw new Error('RTF conversion is not available. Please install the @iarna/rtf-to-html and html-to-markdown packages.');
  }
}

async function convertPdfToMarkdown(filePath) {
  try {
    console.log('Starting PDF conversion');
    const dataBuffer = await readFile(filePath);
    const data = await pdfParse(dataBuffer);
    console.log('PDF conversion successful');
    return data.text;
  } catch (error) {
    console.error('Error in PDF conversion:', error);
    throw error;
  }
}

async function convertAudioToMarkdown(buffer, fileType) {
  let tempFilePath;
  try {
    const tmpobj = tmp.fileSync({ postfix: `.${fileType}`, keep: true });
    tempFilePath = tmpobj.name;
    console.log(`Created temporary file: ${tempFilePath}`);
    await writeFile(tempFilePath, buffer);
    console.log('Temporary file written successfully');
    console.log('Calling transcribeAudio function');
    const transcription = await transcribeAudio(tempFilePath);
    console.log('Transcription completed');
    return `# Audio Transcription\n\n${transcription}`;
  } catch (error) {
    console.error('Error in convertAudioToMarkdown:', error);
    throw error;
  } finally {
    if (tempFilePath) {
      tmp.setGracefulCleanup();
    }
  }
}

async function convertVideoToMarkdown(buffer, fileType) {
  try {
    console.log(`Starting video transcription for ${fileType} file`);
    const transcription = await transcribeVideo(buffer, fileType);
    console.log('Video transcription completed');
    return `# Video Transcription\n\n${transcription}`;
  } catch (error) {
    console.error(`Error transcribing ${fileType} file:`, error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return `# Video Transcription\n\nError: Unable to transcribe ${fileType} file. ${error.message}`;
  }
}import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

// ... (existing code)

export async function convertUrlToMarkdown(url, apiKey) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const dom = new JSDOM(html);
    const turndownService = new TurndownService();
    const markdown = turndownService.turndown(dom.window.document.body.innerHTML);
    return markdown;
  } catch (error) {
    console.error('Error converting URL to markdown:', error);
    throw error;
  }
}