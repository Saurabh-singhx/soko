/**
 * Authentication Middleware Stage
 *
 * Centralizes credential extraction, local loopback trust verification,
 * and Bearer token validation (with 30-day expiration check) against TokenManager.
 */

/**
 * Extracts authentication token from headers or query parameters.
 *
 * @param {import('../core/Context').RequestContext} ctx
 * @returns {string | null}
 */
function extractToken(ctx) {
  const authHeader = (ctx.headers['authorization'] || '').trim();

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (authHeader.startsWith('Token ')) {
    return authHeader.substring(6).trim();
  }

  // Fallback to query parameter ?token=
  if (ctx.query && ctx.query.has('token')) {
    const queryToken = ctx.query.get('token');
    if (queryToken) return queryToken.trim();
  }

  return null;
}

/**
 * Creates the Authentication middleware stage.
 *
 * @param {object} options
 * @param {import('../../../packages/security').TokenManager} [options.tokenManager]
 * @returns {Function} (ctx, next) => Promise<void>
 */
function createAuthStage(options = {}) {
  const tokenManager = options.tokenManager;

  return async function authStage(ctx, next) {
    // 1. Local Loopback Trust (unless overridden by x-simulate-remote-ip)
    if (ctx.isLoopback) {
      ctx.auth = {
        authenticated: true,
        authType: 'loopback',
        token: null,
        tokenExpired: false,
        deviceId: 'local_desktop',
        role: 'admin',
        permissions: new Set(['*']),
      };
      await next();
      return;
    }

    // 2. Remote Client: Extract Bearer/Token credentials
    const token = extractToken(ctx);

    if (token) {
      const validation = tokenManager
        ? tokenManager.validateToken(token)
        : { valid: false, expired: false, device: null };

      if (validation.valid) {
        ctx.auth = {
          authenticated: true,
          authType: 'bearer',
          token,
          tokenExpired: false,
          deviceId: validation.device?.id || null,
          role: 'paired_device',
          permissions: new Set(['companion:read', 'companion:write', 'cli:execute']),
        };
        ctx.device = validation.device;
      } else if (validation.expired) {
        ctx.auth = {
          authenticated: false,
          authType: 'bearer',
          token,
          tokenExpired: true,
          deviceId: validation.device?.id || null,
          role: 'anonymous',
          permissions: new Set(),
        };
      } else {
        ctx.auth = {
          authenticated: false,
          authType: 'bearer',
          token,
          tokenExpired: false,
          deviceId: null,
          role: 'anonymous',
          permissions: new Set(),
        };
      }
    } else {
      ctx.auth = {
        authenticated: false,
        authType: 'none',
        token: null,
        tokenExpired: false,
        deviceId: null,
        role: 'anonymous',
        permissions: new Set(),
      };
    }

    await next();
  };
}

module.exports = {
  createAuthStage,
  extractToken,
};
