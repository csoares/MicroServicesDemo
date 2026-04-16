'use strict';

const Minio  = require('minio');
const config = require('./config');

// MinIO is S3-compatible — the same SDK works against AWS S3 in production.
// Teaching note: swapping MINIO_ENDPOINT for an AWS endpoint is all it takes
// to move from local MinIO to S3.
const client = new Minio.Client({
  endPoint:  config.minio.endPoint,
  port:      config.minio.port,
  useSSL:    false,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

const BUCKET = config.minio.bucket;

/**
 * Upload a buffer to MinIO.
 * @param {string} objectKey  - e.g. 'originals/uuid-photo.jpg'
 * @param {Buffer} buffer     - file content from multer memory storage
 * @param {string} contentType - MIME type
 */
async function putObject(objectKey, buffer, contentType) {
  await client.putObject(BUCKET, objectKey, buffer, buffer.length, {
    'Content-Type': contentType,
  });
}

/**
 * Delete an object from MinIO. Silently ignores "not found" errors
 * (e.g. thumbnail not yet written when photo is deleted while pending).
 * @param {string} objectKey - e.g. 'originals/uuid-photo.jpg'
 */
async function removeObject(objectKey) {
  try {
    await client.removeObject(BUCKET, objectKey);
  } catch (err) {
    if (err.code !== 'NoSuchKey') throw err;
  }
}

module.exports = { client, BUCKET, putObject, removeObject };
