// src/lib/constants.js

// File related constants
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'application/pdf',
  'text/plain',
  'text/html',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// API related constants
export const API_KEY_MIN_LENGTH = 32;

// UI related constants
export const CONVERSION_STATUSES = {
  READY: 'ready',
  CONVERTING: 'converting',
  COMPLETED: 'completed',
  ERROR: 'error'
};

// Color scheme
export const COLORS = {
  PRIMARY: '#00a99d',
  SECONDARY: '#93278f',
  TERTIARY: '#fbf7f1',
  TEXT: '#333333',
  BACKGROUND: '#ffffff',
  ERROR: '#ff3860'
};

// CSS related constants
export const CSS = {
  ROUNDED_CORNERS: '12px',
  TRANSITION_SPEED: '0.3s',
  BOX_SHADOW: '0 4px 6px rgba(0, 0, 0, 0.1)'
};

// Local storage keys
export const STORAGE_KEYS = {
  API_KEY: 'obsdian_note_converter_api_key'
};

// File type mappings
export const FILE_TYPE_ICONS = {
  document: 'file-text',
  image: 'image',
  video: 'video',
  audio: 'music',
  pdf: 'file-text',
  text: 'file-text',
  html: 'code',
  docx: 'file-text'
};

// Error messages
export const ERROR_MESSAGES = {
  FILE_TOO_LARGE: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
  UNSUPPORTED_FILE_TYPE: 'Unsupported file type',
  API_KEY_REQUIRED: 'API key is required',
  INVALID_API_KEY: 'Invalid API key format',
  INVALID_URL: 'Invalid URL format',
  NO_FILES_FOR_CONVERSION: 'At least one file is required for conversion'
};