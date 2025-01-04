// services/converter/data/jsonConverter.js

/**
 * Converts a JSON buffer or string to Markdown format.
 * @param {Buffer|string} input - The JSON content as a buffer or string.
 * @param {string} originalName - Original filename for context.
 * @param {string} [apiKey] - API key if needed.
 * @returns {Promise<{ content: string, images: Array }>} - Converted content and images.
 */
export async function convertJsonToMarkdown(input, originalName, apiKey) {
  try {
    // Convert buffer to string if necessary
    const jsonContent = Buffer.isBuffer(input) ? input.toString('utf-8') : input;

    // Parse the JSON data
    const jsonData = JSON.parse(jsonContent);

    // Convert JSON to Markdown
    const markdownContent = jsonToMarkdown(jsonData);
    return {
      content: markdownContent,
      images: []
    };
  } catch (error) {
    console.error('Error converting JSON to Markdown:', error);
    throw error;
  }
}

/**
 * Recursively converts JSON data to Markdown format.
 * @param {any} data - The JSON data to convert.
 * @param {number} depth - The current depth for nested structures.
 * @returns {string} - The converted Markdown string.
 */
function jsonToMarkdown(data, depth = 0) {
  const indent = '  '.repeat(depth);
  if (Array.isArray(data)) {
    return data.map(item => `${indent}- ${jsonToMarkdown(item, depth + 1)}`).join('\n');
  } else if (typeof data === 'object' && data !== null) {
    return Object.entries(data).map(([key, value]) => `${indent}- **${key}**: ${jsonToMarkdown(value, depth + 1)}`).join('\n');
  } else {
    return String(data);
  }
}