/**
 * Rate Limiting Middleware Stage
 *
 * Integrates Soko's RateLimiter to defend pairing and sensitive endpoints
 * against brute-force attacks, attaching standard Retry-After headers and emitting
 * HTTP 429 Too Many Requests responses.
 */

const { TooManyRequestsError } = require('../core/errors');
const { classifyRoute } = require('../routing/routes');

/**
 * Creates the Rate Limiting middleware stage.
 *
 * @param {object} options
 * @param {import('../../../packages/security').RateLimiter} [options.rateLimiter]
 * @param {((ctx: any) => boolean)} [options.shouldRateLimit]
 * @returns {Function} (ctx, next) => Promise<void>
 */
function createRateLimitStage(options = {}) {
  const rateLimiter = options.rateLimiter;
  const isRateLimitedFn = options.shouldRateLimit || ((ctx) => {
    const classification = classifyRoute(ctx.method, ctx.pathname);
    return Boolean(classification.rateLimited);
  });

  return async function rateLimitStage(ctx, next) {
    if (!rateLimiter) {
      await next();
      return;
    }

    // Attach convenience helpers for downstream handlers
    ctx.recordFailure = () => rateLimiter.recordFailure(ctx.clientIp);
    ctx.recordSuccess = () => rateLimiter.recordSuccess(ctx.clientIp);

    if (isRateLimitedFn(ctx)) {
      const check = rateLimiter.checkLimit(ctx.clientIp);
      ctx.rateLimit = {
        checked: true,
        allowed: check.allowed,
        attempts: check.attempts,
        retryAfter: check.retryAfter,
      };

      if (!check.allowed) {
        const errorReason = check.reason || (check.blocked ? 'IP_BLOCKED' : 'RATE_LIMITED');
        throw new TooManyRequestsError(
          `Too Many Requests: Rate limit active. Retry after ${check.retryAfter} seconds.`,
          check.retryAfter,
          { error: errorReason }
        );
      }
    }

    await next();
  };
}

module.exports = {
  createRateLimitStage,
};
