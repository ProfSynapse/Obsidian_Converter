// services/converter/data/xlsxConverter.js

import xlsx from 'xlsx';

/**
 * Converts an XLSX buffer or string to Markdown format.
 * @param {Buffer|string} input - The XLSX content as a buffer or string (file path not used).
 * @param {string} originalName - Original filename for context.
 * @param {string} [apiKey] - API key if needed.
 * @returns {Promise<{ content: string, images: Array }>} - Converted content and images.
 */
export async function convertXlsxToMarkdown(input, originalName, apiKey) {
  try {
    let workbook;
    if (Buffer.isBuffer(input)) {
      workbook = xlsx.read(input, { type: 'buffer' });
    } else {
      // If input is a string, assume it's a buffer represented as a string (unlikely)
      throw new Error('Invalid input type for XLSX converter. Expected a Buffer.');
    }

    // Convert each sheet to Markdown
    const markdownSheets = workbook.SheetNames.map(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      
      if (jsonData.length === 0) {
        return `## ${sheetName}\n\nThis sheet is empty.`;
      }

      const headers = jsonData[0];
      let markdownTable = `## ${sheetName}\n\n`;
      markdownTable += `| ${headers.join(' | ')} |\n`;
      markdownTable += `| ${headers.map(() => '---').join(' | ')} |\n`;

      jsonData.slice(1).forEach(row => {
        markdownTable += `| ${row.map(cell => cell !== null && cell !== undefined ? cell : '').join(' | ')} |\n`;
      });

      return markdownTable;
    });

    // Combine all sheets
    const combinedMarkdown = markdownSheets.join('\n\n');
    
    return { content: combinedMarkdown, images: [] };
  } catch (error) {
    console.error('Error converting XLSX to Markdown:', error);
    throw error;
  }
}
