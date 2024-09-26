// backend/src/inputProcessors/index.js

import { textProcessor } from './textProcessor.js';
import { docxProcessor } from './docxProcessor.js';
import { pdfProcessor } from './pdfProcessor.js';
import { audioProcessor } from './audioProcessor.js';
import { videoProcessor } from './videoProcessor.js';
import { imageProcessor } from './imageProcessor.js';

export {
  textProcessor,
  docxProcessor,
  pdfProcessor,
  audioProcessor,
  videoProcessor,
  imageProcessor
};