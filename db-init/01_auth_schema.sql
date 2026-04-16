-- Auth Service Database
-- Runs automatically when the postgres container first starts.
-- File is prefixed 01_ to ensure it runs before 02_gallery_schema.sql.

CREATE DATABASE auth_db;

\c auth_db;

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT         NOT NULL,
    created_at    TIMESTAMP    DEFAULT NOW()
);
