// services/converter/data/csvConverter.js

import { parse } from 'csv-parse/sync';

/**
 * Converts a CSV buffer or string to Markdown format.
 * @param {Buffer|string} input - The CSV content as a buffer or string.
 * @param {string} originalName - Original filename for context.
 * @param {string} [apiKey] - API key if needed.
 * @returns {Promise<{ content: string, images: Array }>} - Converted content and images.
 */
export async function convertCsvToMarkdown(input, originalName, apiKey) {
  try {
    // Convert buffer to string if necessary
    const csvContent = Buffer.isBuffer(input) ? input.toString('utf-8') : input;

    // Parse the CSV data
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });

    if (records.length === 0) {
      return { content: "The CSV file is empty.", images: [] };
    }

    // Get headers
    const headers = Object.keys(records[0]);

    // Create Markdown table
    let markdownTable = `| ${headers.join(' | ')} |\n`;
    markdownTable += `| ${headers.map(() => '---').join(' | ')} |\n`;

    // Add data rows
    records.forEach(record => {
      markdownTable += `| ${headers.map(header => record[header] || '').join(' | ')} |\n`;
    });

    return { content: markdownTable, images: [] };
  } catch (error) {
    console.error('Error converting CSV to Markdown:', error);
    throw error;
  }
}
