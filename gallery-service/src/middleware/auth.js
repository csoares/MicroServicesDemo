'use strict';

const config = require('../config');

/**
 * authMiddleware verifies the Bearer JWT by calling the auth-service /auth/validate endpoint.
 *
 * This is service-to-service HTTP — gallery-service doesn't need to know the JWT secret.
 * The auth-service is the single source of truth for token validation.
 *
 * Teaching note: This pattern (delegated validation) avoids sharing secrets between services.
 * The trade-off is one extra HTTP call per authenticated request.
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const response = await fetch(`${config.authServiceUrl}/auth/validate`, {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userData = await response.json();
    // Attach user info to the request object for downstream handlers
    req.user = userData;
    next();
  } catch (err) {
    console.error('Auth service unreachable:', err.message);
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
}

module.exports = authMiddleware;
