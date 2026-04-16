'use strict';

const { Pool } = require('pg');
const config = require('./config');

// pg.Pool manages a pool of connections to PostgreSQL.
// Queries are load-balanced across idle connections automatically.
const pool = new Pool(config.db);

pool.on('error', (err) => {
  // Log unexpected errors but keep the service alive
  console.error('Unexpected PostgreSQL client error:', err.message);
});

/**
 * Run a parameterised SQL query.
 * @param {string} text  — SQL statement with $1, $2, … placeholders
 * @param {any[]}  params — values for the placeholders
 */
async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

module.exports = { query };
