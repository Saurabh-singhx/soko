/**
 * Transport & CORS Hardener Middleware Stage
 *
 * Enforces DNS rebinding defense via Host header verification, validates Origin headers,
 * handles OPTIONS preflight immediately with 204 No Content, and ensures strict CORS
 * response headers without wildcard '*' leakage.
 */

const { BadRequestError, ForbiddenError } = require('../core/errors');

/**
 * Creates the CORS and Transport Hardening middleware stage.
 *
 * @param {object} options
 * @param {import('../../../packages/security').CorsHardener} [options.corsHardener]
 * @returns {Function} (ctx, next) => Promise<void>
 */
function createCorsStage(options = {}) {
  const corsHardener = options.corsHardener;

  return async function corsStage(ctx, next) {
    if (!corsHardener) {
      await next();
      return;
    }

    const host = ctx.headers['host'];
    if (host && !corsHardener.isHostAllowed(host)) {
      throw new BadRequestError(
        'Bad Request: Invalid Host header (DNS Rebinding Protection)',
        'DNS_REBINDING_BLOCKED',
        { host }
      );
    }

    const origin = ctx.headers['origin'];

    // Handle OPTIONS Preflight
    if (ctx.method === 'OPTIONS') {
      if (origin && !corsHardener.isOriginAllowed(origin)) {
        throw new ForbiddenError(
          'Forbidden: CORS origin rejected by security policy',
          'CORS_ORIGIN_FORBIDDEN',
          { code: 403 }
        );
      }

      const corsHeaders = corsHardener.getCorsHeaders(ctx.req);
      ctx.res.writeHead(204, corsHeaders);
      ctx.res.end();
      ctx.sent = true;
      return; // Short-circuit pipeline on preflight
    }

    // Origin header validation for non-preflight requests
    if (origin && !corsHardener.isOriginAllowed(origin)) {
      throw new ForbiddenError(
        'Forbidden: Untrusted Cross-Origin Request Blocked by Soko Security Guardrails',
        'CORS_ORIGIN_FORBIDDEN',
        { origin, code: 403 }
      );
    }

    // Attach verified CORS headers to context for subsequent responses
    ctx._corsHeaders = corsHardener.getCorsHeaders(ctx.req);

    await next();
  };
}

module.exports = {
  createCorsStage,
};
