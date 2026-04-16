'use strict';

const multer = require('multer');
const path   = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

// Store uploaded files on disk under /uploads/originals/
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(config.uploadDir, 'originals'));
  },
  filename: (_req, file, cb) => {
    // Prefix with UUID to avoid filename collisions when multiple users upload
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uuidv4()}-${safeName}`);
  },
});

// Only accept image files
const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are accepted'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

module.exports = { upload };
