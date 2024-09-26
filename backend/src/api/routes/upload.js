// backend/src/api/routes/upload.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../../utils/logger');

const router = express.Router();

// Ensure the uploads directory exists
const uploadDirectory = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

/**
 * Multer storage configuration
 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDirectory);
  },
  filename: function (req, file, cb) {
    // Use original file name
    cb(null, Date.now() + '-' + file.originalname);
  },
});

/**
 * File filter to allow only specific file types
 * Adjust the MIME types as per your requirements
 */
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg',
    'video/mp4',
    'image/jpeg',
    'image/png',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Unsupported file type. Allowed types: TXT, PDF, DOCX, MP3, MP4, JPEG, PNG'
      ),
      false
    );
  }
};

/**
 * Initialize Multer with storage and file filter
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB file size limit
});

/**
 * @route POST /api/upload
 * @description Upload a file to the server
 * @access Public
 */
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    logger.info(`File uploaded: ${req.file.filename}`);

    // Respond with file details
    res.status(200).json({
      message: 'File uploaded successfully.',
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
      },
    });
  } catch (error) {
    logger.error(`Upload error: ${error.message}`);
    res.status(500).json({ message: 'Server error during file upload.' });
  }
});

module.exports = router;