/**
 * @soko/security
 * 
 * Production-ready Zero-Trust Security, TLS Engine, PIN Rate Limiting,
 * OS-standard Trust Store, CORS/Host Hardening, and Bearer Token Rotation.
 */

const {
  DEFAULT_TOKEN_TTL_MS,
  DEFAULT_PORT,
  RATE_LIMIT_CONFIG,
  resolveConfigDir,
  ensureConfigDir,
  getSecurityPaths,
} = require('./src/config');

const { TrustStore } = require('./src/trustStore');
const { RateLimiter } = require('./src/rateLimiter');
const { CorsHardener } = require('./src/corsHardener');
const { TokenManager } = require('./src/tokenManager');
const { TlsEngine } = require('./src/tlsEngine');

module.exports = {
  // Constants
  DEFAULT_TOKEN_TTL_MS,
  DEFAULT_PORT,
  RATE_LIMIT_CONFIG,

  // Path resolution
  resolveConfigDir,
  ensureConfigDir,
  getSecurityPaths,

  // Core Security Classes
  TrustStore,
  RateLimiter,
  CorsHardener,
  TokenManager,
  TlsEngine,
};
