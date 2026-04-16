'use strict';

// All configuration comes from environment variables.
// docker-compose.yml sets these; fall-backs are for local development.
module.exports = {
  port: process.env.PORT || '8002',

  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    user:     process.env.DB_USER     || 'demo',
    password: process.env.DB_PASSWORD || 'demo123',
    database: process.env.DB_NAME     || 'gallery_db',
  },

  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',

  uploadDir: process.env.UPLOAD_DIR || '/uploads',

  // The auth-service base URL — used for token validation (service-to-service call)
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://auth-service:8001',
};
