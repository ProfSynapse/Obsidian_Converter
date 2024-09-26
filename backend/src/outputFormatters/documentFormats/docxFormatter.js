// backend/src/outputFormatters/docxFormatter.js

import FormatterInterface from './formatterInterface.js';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import logger from '../utils/logger.js';

/**
 * @file docxFormatter.js
 * @description Formatter for DOCX files.
 */
export default class DocxFormatter extends FormatterInterface {
  /**
   * Formats the content into DOCX.
   * @param {string} content - The enhanced content with metadata and summary.
   * @returns {Promise<Buffer>} The formatted DOCX file as a buffer.
   */
  async format(content) {
    try {
      logger.info('Formatting content to DOCX.');

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: content,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      return buffer;
    } catch (error) {
      logger.error(`Error formatting to DOCX: ${error.message}`);
      throw new Error('DOCX formatting failed');
    }
  }
}
