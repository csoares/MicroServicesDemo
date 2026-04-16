'use strict';

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const db       = require('../db');
const { upload }  = require('../storage');
const minio    = require('../minio');
const rabbitmq = require('../rabbitmq');
const auth     = require('../middleware/auth');

const router = express.Router();

/**
 * POST /photos/upload
 * Accepts a multipart/form-data request with a single "photo" field.
 *
 * Flow:
 *   1. multer reads file into memory (req.file.buffer)
 *   2. Upload buffer to MinIO under originals/<uuid>-<name>
 *   3. Insert photo row in PostgreSQL (status = pending)
 *   4. Publish photo.uploaded event to RabbitMQ
 *   5. Return 201 immediately — processing is async
 *
 * Important: Do NOT set Content-Type manually in the frontend when sending
 * FormData — the browser sets it with the correct multipart boundary.
 */
router.post('/upload', auth, upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const photoId   = uuidv4();
  const objectKey = `originals/${uuidv4()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  try {
    // Upload original to MinIO
    await minio.putObject(objectKey, req.file.buffer, req.file.mimetype);

    // Record metadata in PostgreSQL
    // file_path stores the URL-style path so the frontend/API stays consistent
    const filePath = `/uploads/${objectKey}`;
    const result = await db.query(
      `INSERT INTO photos (id, uploader_id, original_filename, file_path, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [photoId, req.user.user_id, req.file.originalname, filePath]
    );

    // Publish event — image-processor will pick this up asynchronously
    await rabbitmq.publishPhotoUploaded(photoId, objectKey);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Could not save photo' });
  }
});

/**
 * GET /photos/
 * Returns all photos ordered by upload time (newest first).
 * The frontend polls this endpoint to detect status changes: pending → processed.
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

/**
 * DELETE /photos/:id
 * Deletes a photo and all its associated objects from MinIO.
 * Any authenticated user can delete any photo.
 */
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('SELECT * FROM photos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = result.rows[0];

    // Derive MinIO object keys from the stored URL-style paths
    // e.g. /uploads/originals/uuid-name.jpg → originals/uuid-name.jpg
    const toKey = (path) => path ? path.replace('/uploads/', '') : null;

    const keys = [
      toKey(photo.file_path),
      toKey(photo.thumbnail_path),
      toKey(photo.medium_path),
    ].filter(Boolean);

    // Delete all objects from MinIO (original + processed variants)
    await Promise.all(keys.map(key => minio.removeObject(key)));

    // Remove the metadata row from PostgreSQL
    await db.query('DELETE FROM photos WHERE id = $1', [id]);

    res.status(204).end();
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(500).json({ error: 'Could not delete photo' });
  }
});

module.exports = router;
