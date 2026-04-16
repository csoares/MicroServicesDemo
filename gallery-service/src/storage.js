'use strict';

const multer = require('multer');

// Memory storage — files land in req.file.buffer instead of on disk.
// gallery-service streams them straight to MinIO, so no local filesystem needed.
// Teaching note: for very large files (> hundreds of MB) disk buffering would
// be safer to avoid OOM; memory storage is fine for typical photo sizes.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are accepted'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

module.exports = { upload };
