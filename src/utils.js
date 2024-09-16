// utils.js - Utility functions for Obsidian Note Enhancer

import fs from 'fs/promises';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - The path of the directory to ensure
 * @returns {Promise<void>}
 */
export async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(dirPath, { recursive: true });
    } else {
      throw error;
    }
  }
}

/**
 * Read all files from a directory
 * @param {string} dirPath - The path of the directory to read
 * @returns {Promise<string[]>} An array of file names in the directory
 */
export async function readDir(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
}

/**
 * Read the content of a file
 * @param {string} filePath - The path of the file to read
 * @returns {Promise<Buffer>} The content of the file as a Buffer
 */
export async function readFile(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Write content to a file
 * @param {string} filePath - The path of the file to write
 * @param {string|Buffer} content - The content to write to the file
 * @returns {Promise<void>}
 */
export async function writeFile(filePath, content) {
  try {
    await fs.writeFile(filePath, content);
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Determine the type of a file from its content
 * @param {Buffer} fileBuffer - The content of the file as a Buffer
 * @returns {Promise<string|null>} The file extension or null if not determined
 */
export async function getFileType(fileBuffer) {
  try {
    const type = await fileTypeFromBuffer(fileBuffer);
    return type ? type.ext : null;
  } catch (error) {
    console.error('Error determining file type:', error);
    return null;
  }
}

/**
 * Sanitize a string for use as a filename
 * @param {string} name - The string to sanitize
 * @returns {string} The sanitized string
 */
export function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Truncate a string to a specified length
 * @param {string} str - The string to truncate
 * @param {number} maxLength - The maximum length of the string
 * @returns {string} The truncated string
 */
export function truncateString(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Parse front matter from a markdown string
 * @param {string} content - The markdown content
 * @returns {Object} An object containing the front matter and the rest of the content
 */
export function parseFrontMatter(content) {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontMatterRegex);
  if (!match) return { frontMatter: null, content };

  const frontMatterString = match[1];
  const frontMatter = {};
  frontMatterString.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      frontMatter[key.trim()] = valueParts.join(':').trim();
    }
  });

  const contentWithoutFrontMatter = content.slice(match[0].length).trim();
  return { frontMatter, content: contentWithoutFrontMatter };
}

/**
 * Extract all wikilinks from a markdown string
 * @param {string} content - The markdown content
 * @returns {string[]} An array of wikilinks found in the content
 */
export function extractWikilinks(content) {
  const wikiLinkRegex = /\[\[(.*?)\]\]/g;
  const matches = content.match(wikiLinkRegex);
  return matches ? matches.map(match => match.slice(2, -2)) : [];
}

/**
 * Validate the configuration object
 * @param {Object} config - The configuration object to validate
 * @returns {boolean} True if the configuration is valid, false otherwise
 */
export function validateConfig(config) {
  const requiredFields = ['llm', 'frontMatter', 'wikilinks'];
  const requiredLLMFields = ['model', 'temperature', 'max_tokens'];
  const requiredFrontMatterFields = ['systemPrompt', 'temperature', 'max_tokens'];
  const requiredWikilinksFields = ['systemPrompt', 'temperature', 'max_tokens'];

  if (!requiredFields.every(field => field in config)) {
    console.error('Missing required top-level fields in config');
    return false;
  }

  if (!requiredLLMFields.every(field => field in config.llm)) {
    console.error('Missing required fields in config.llm');
    return false;
  }

  if (!requiredFrontMatterFields.every(field => field in config.frontMatter)) {
    console.error('Missing required fields in config.frontMatter');
    return false;
  }

  if (!requiredWikilinksFields.every(field => field in config.wikilinks)) {
    console.error('Missing required fields in config.wikilinks');
    return false;
  }

  return true;
}