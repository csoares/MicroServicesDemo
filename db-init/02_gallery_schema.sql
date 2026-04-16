-- Gallery Service Database
-- Runs automatically after 01_auth_schema.sql.

CREATE DATABASE gallery_db;

\c gallery_db;

CREATE TABLE photos (
    id                UUID         PRIMARY KEY,
    uploader_id       INT          NOT NULL,
    original_filename VARCHAR(255),
    file_path         TEXT         NOT NULL,
    thumbnail_path    TEXT,
    medium_path       TEXT,
    status            VARCHAR(20)  DEFAULT 'pending',  -- 'pending' | 'processed' | 'error'
    uploaded_at       TIMESTAMP    DEFAULT NOW()
);

-- Index for fetching a user's photos quickly
CREATE INDEX idx_photos_uploader ON photos(uploader_id);
