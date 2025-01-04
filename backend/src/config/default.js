// config/default.js

export const config = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  api: {
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      timeout: 300000,
      maxRetries: 3,
      apiKey: process.env.OPENAI_API_KEY
    }
  },
  conversion: {
    allowedFileTypes: [
      "txt", "pdf", "docx", "pptx",
      "csv", "xlsx",
      "mp3", "wav", "m4a",
      "mp4", "webm", "avi"
    ],
    maxFileSize: 52428800
  },
  storage: {
    tempDir: '/tmp/obsidian-converter'
  },
  security: {
    rateLimitPerMinute: 100
  }
};
