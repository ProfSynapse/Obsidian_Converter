// server.js

import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, extname, basename } from 'path';
import { convertToMarkdown, convertUrlToMarkdown } from './src/converter.js';
import { enhanceNote } from './src/enhancer.js';
import { ensureDir } from './src/utils.js';
import dotenv from 'dotenv';

// Configure environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

// CORS configuration
const corsOptions = {
  origin: 'http://localhost:5173', // Allow requests from Svelte frontend
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Ensure the uploads directory exists
ensureDir('uploads');

// Routes
app.post('/convert', upload.single('file'), async (req, res) => {
  const { file } = req;
  const apiKey = req.body.apiKey;
  const url = req.body.url;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  try {
    // Set the OpenAI API key from the request
    process.env.OPENAI_API_KEY = apiKey;

    let content;
    let fileName;

    if (file) {
      // Convert the uploaded file to markdown
      content = await convertToMarkdown(file.path, extname(file.originalname).slice(1));
      fileName = basename(file.originalname, extname(file.originalname));
    } else if (url) {
      // Convert the URL to markdown
      content = await convertUrlToMarkdown(url);
      fileName = new URL(url).hostname;
    } else {
      return res.status(400).json({ error: 'No file uploaded or URL provided' });
    }

    // Enhance the converted content
    const enhancedContent = await enhanceNote(content, fileName);

    res.json({ convertedContent: enhancedContent });
  } catch (error) {
    console.error('Error during conversion:', error);
    res.status(500).json({ error: 'Conversion failed', details: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Accepting requests from http://localhost:5173`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    console.log('HTTP server closed');
  });
});
