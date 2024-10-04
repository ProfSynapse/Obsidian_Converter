// converter.js
import { transcribeAudio, transcribeVideo } from './transcriber.js';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import rtfToHTML from '@iarna/rtf-to-html';
import htmlToMarkdown from 'html-to-markdown';

/**
 * Convert content to markdown based on its type
 * @param {string} content - The content to convert
 * @param {string} contentType - The type of content (e.g., 'txt', 'html', 'docx')
 * @param {string} apiKey - The OpenAI API key
 * @returns {Promise<string>} The content converted to markdown
 */
export async function convertToMarkdown(content, contentType, apiKey) {
  console.log(`Converting content of type: ${contentType}`);

  switch (contentType.toLowerCase()) {
    case 'txt':
      return content;
    case 'html':
    case 'htm':
      return convertHtmlToMarkdown(content);
    case 'docx':
      return convertDocxToMarkdown(content);
    case 'rtf':
      return convertRtfToMarkdown(content);
    case 'pdf':
      return convertPdfToMarkdown(content);
    case 'mp3':
    case 'wav':
    case 'm4a':
    case 'ogg':
      return await convertAudioToMarkdown(content, contentType, apiKey);
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'webm':
      return await convertVideoToMarkdown(content, contentType, apiKey);
    default:
      console.warn(`Unsupported content type: ${contentType}. Treating as plain text.`);
      return content;
  }
}

/**
 * Convert HTML content to Markdown
 * @param {string} htmlContent - The HTML content to convert
 * @returns {string} The converted Markdown content
 */
function convertHtmlToMarkdown(htmlContent) {
  return htmlToMarkdown.convert(htmlContent);
}

/**
 * Convert DOCX content to Markdown
 * @param {Buffer} buffer - The DOCX content as a buffer
 * @returns {Promise<string>} The converted Markdown content
 */
async function convertDocxToMarkdown(buffer) {
  try {
    console.log('Starting DOCX conversion');
    const result = await mammoth.convertToMarkdown({ buffer });
    console.log('DOCX conversion successful');
    return result.value;
  } catch (error) {
    console.error('Error in DOCX conversion:', error);
    throw error;
  }
}

/**
 * Convert RTF content to Markdown
 * @param {string} rtfContent - The RTF content to convert
 * @returns {Promise<string>} The converted Markdown content
 */
async function convertRtfToMarkdown(rtfContent) {
  return new Promise((resolve, reject) => {
    rtfToHTML.fromString(rtfContent, (err, html) => {
      if (err) reject(err);
      else resolve(convertHtmlToMarkdown(html));
    });
  });
}

/**
 * Convert PDF content to Markdown
 * @param {Buffer} pdfBuffer - The PDF content as a buffer
 * @returns {Promise<string>} The extracted text from the PDF
 */
async function convertPdfToMarkdown(pdfBuffer) {
  try {
    console.log('Starting PDF conversion');
    const data = await pdfParse(pdfBuffer);
    console.log('PDF conversion successful');
    return data.text;
  } catch (error) {
    console.error('Error in PDF conversion:', error);
    throw error;
  }
}

/**
 * Convert audio content to Markdown
 * @param {Buffer} audioBuffer - The audio content as a buffer
 * @param {string} fileType - The type of audio file
 * @param {string} apiKey - The OpenAI API key
 * @returns {Promise<string>} The transcribed audio as Markdown
 */
async function convertAudioToMarkdown(audioBuffer, fileType, apiKey) {
  try {
    console.log(`Starting audio transcription for ${fileType} content`);
    const transcription = await transcribeAudio(audioBuffer, fileType, apiKey);
    console.log('Audio transcription completed');
    return `# Audio Transcription\n\n${transcription}`;
  } catch (error) {
    console.error(`Error transcribing ${fileType} content:`, error);
    throw error;
  }
}

/**
 * Convert video content to Markdown
 * @param {Buffer} videoBuffer - The video content as a buffer
 * @param {string} fileType - The type of video file
 * @param {string} apiKey - The OpenAI API key
 * @returns {Promise<string>} The transcribed video as Markdown
 */
async function convertVideoToMarkdown(videoBuffer, fileType, apiKey) {
  try {
    console.log(`Starting video transcription for ${fileType} content`);
    const transcription = await transcribeVideo(videoBuffer, fileType, apiKey);
    console.log('Video transcription completed');
    return `# Video Transcription\n\n${transcription}`;
  } catch (error) {
    console.error(`Error transcribing ${fileType} content:`, error);
    throw error;
  }
}

/**
 * Convert URL content to Markdown
 * @param {string} url - The URL to convert
 * @param {string} apiKey - The OpenAI API key
 * @returns {Promise<string>} The converted content as Markdown
 */
export async function convertUrlToMarkdown(url, apiKey) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    return convertHtmlToMarkdown(html);
  } catch (error) {
    console.error('Error converting URL to markdown:', error);
    throw error;
  }
}