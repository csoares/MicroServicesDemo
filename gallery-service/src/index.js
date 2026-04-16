'use strict';

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const config   = require('./config');
const rabbitmq = require('./rabbitmq');
const photos   = require('./routes/photos');

const app = express();

// Parse JSON bodies
app.use(express.json());

// CORS — same note as auth-service: Nginx proxy makes this unnecessary in Compose,
// but useful when developing services individually.
app.use(cors());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gallery-service' });
});

// Photo routes
app.use('/photos', photos);

// Global error handler for multer and other middleware errors
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Connect to RabbitMQ, then start the HTTP server
rabbitmq.setup()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`gallery-service listening on :${config.port}`);
    });
  })
  .catch((err) => {
    console.error('Fatal startup error:', err.message);
    process.exit(1);
  });
