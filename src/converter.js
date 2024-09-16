// converter.js - File type conversion logic

import { readFile } from 'fs/promises';
import { extname } from 'path';

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
 * Convert a file buffer to markdown based on its file type
 * @param {Buffer} fileBuffer - The file content as a buffer
 * @param {string} fileType - The file extension or type
 * @returns {Promise<string>} The file content converted to markdown
 */
export async function convertToMarkdown(fileBuffer, fileType) {
  switch (fileType.toLowerCase()) {
    case 'txt':
      return convertTextToMarkdown(fileBuffer);
    case 'html':
    case 'htm':
      return convertHtmlToMarkdown(fileBuffer);
    case 'docx':
      return convertDocxToMarkdown(fileBuffer);
    case 'rtf':
      return convertRtfToMarkdown(fileBuffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Convert plain text to markdown (no conversion needed)
 * @param {Buffer} buffer - The text file content as a buffer
 * @returns {string} The text content as a string
 */
function convertTextToMarkdown(buffer) {
  return buffer.toString('utf-8');
}

/**
 * Convert HTML to markdown
 * @param {Buffer} buffer - The HTML file content as a buffer
 * @returns {Promise<string>} The HTML content converted to markdown
 */
async function convertHtmlToMarkdown(buffer) {
  const htmlContent = buffer.toString('utf-8');
  if (htmlToMarkdown) {
    return htmlToMarkdown.convert(htmlContent);
  } else {
    console.warn('HTML to Markdown conversion not available. Returning raw HTML.');
    return htmlContent;
  }
}

/**
 * Convert DOCX to markdown
 * @param {Buffer} buffer - The DOCX file content as a buffer
 * @returns {Promise<string>} The DOCX content converted to markdown
 */
async function convertDocxToMarkdown(buffer) {
  if (mammoth) {
    const result = await mammoth.convertToMarkdown({ buffer });
    return result.value;
  } else {
    throw new Error('DOCX conversion is not available. Please install the mammoth package.');
  }
}

/**
 * Convert RTF to markdown
 * @param {Buffer} buffer - The RTF file content as a buffer
 * @returns {Promise<string>} The RTF content converted to markdown
 */
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