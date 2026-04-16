'use strict';

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const path     = require('path');
const db       = require('../db');
const { upload }  = require('../storage');
const rabbitmq = require('../rabbitmq');
const auth     = require('../middleware/auth');

const router = express.Router();

/**
 * POST /photos/upload
 * Accepts a multipart/form-data request with a single "photo" field.
 * Saves the file, records metadata, and publishes a RabbitMQ event for processing.
 *
 * Important: Do NOT set Content-Type manually in the frontend when sending FormData —
 * the browser sets it automatically with the correct multipart boundary.
 */
router.post('/upload', auth, upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const photoId = uuidv4();
  const filePath = req.file.path; // absolute path on the shared volume

  try {
    const result = await db.query(
      `INSERT INTO photos (id, uploader_id, original_filename, file_path, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [photoId, req.user.user_id, req.file.originalname, filePath]
    );

    const photo = result.rows[0];

    // Publish an event — the image-processor will pick this up asynchronously
    await rabbitmq.publishPhotoUploaded(photoId, filePath);

    res.status(201).json(photo);
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Could not save photo' });
  }
});

/**
 * GET /photos
 * Returns all photos ordered by upload time (newest first).
 * The frontend polls this to detect when status changes from 'pending' to 'processed'.
 */
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, uploader_id, original_filename, file_path,
              thumbnail_path, medium_path, status, uploaded_at
       FROM photos
       ORDER BY uploaded_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('List photos error:', err.message);
    res.status(500).json({ error: 'Could not retrieve photos' });
  }
});

module.exports = router;
